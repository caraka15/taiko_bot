require("dotenv").config();
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const axios = require("axios");
const { ethers } = require("ethers");
const chalk = require("chalk");

const execPromise = util.promisify(exec);
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
let isOperationRunning = false;
let completedIterations = 0;
const walletFees = new Map(); // Track fees per wallet

// Store points for each wallet
const walletPoints = new Map();

// Store pending transactions
const pendingTransactions = new Map();

const REQUIRED_CONFIRMATIONS = config.confirmation.required;
const MAX_RETRIES = config.confirmation.maxRetries;
const RETRY_DELAY = config.confirmation.retryDelay;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xA51894664A773981C6C112C43ce576f315d5b1B6";

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

function logWithBorder(message, borderChar = "=") {
  const line = borderChar.repeat(100);
  console.log(chalk.yellow(`\n${line}`));
  console.log(message);
  console.log(chalk.yellow(line));
}

function getWalletConfigs() {
  const privateKeys = Object.keys(process.env)
    .filter((key) => key.startsWith("PRIVATE_KEY_"))
    .sort() // Ensure consistent ordering
    .map((key) => {
      const walletNum = key.split('_')[2]; // PRIVATE_KEY_1 -> 1
      const walletKey = `wallet${walletNum}`; // wallet1
      const walletConfig = config.wallets?.[walletKey] || {
        // Default values if no specific configuration exists
        amount_min: config.amount_min || "0.001",
        amount_max: config.amount_max || "0.003"
      };

      return {
        privateKey: process.env[key],
        config: walletConfig
      };
    });

  return privateKeys;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentServerTime() {
  return chalk.gray(moment()
    .tz(config.timezone || "Asia/Jakarta")
    .format("YYYY-MM-DD HH:mm:ss"));
}

async function sendTelegramNotification(message) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Content-Type": "application/json",
  };

  try {
    await axios.post(
      url,
      {
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      },
      { headers }
    );
    logWithBorder(chalk.green("✓ Telegram notification sent successfully"));
  } catch (error) {
    logWithBorder(chalk.red(`✗ Failed to send Telegram notification: ${error.message}`));
  }
}

async function getEthToUsdRate() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    return response.data.ethereum.usd;
  } catch (error) {
    logWithBorder(chalk.red(`✗ Failed to fetch ETH to USD rate: ${error.message}`));
    return null;
  }
}

async function fetchTaikoPoints(address) {
  try {
    const headers = {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Origin': 'https://trailblazer.mainnet.taiko.xyz',
      'Referer': 'https://trailblazer.mainnet.taiko.xyz/',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    const response = await axios.get(
      `https://trailblazer.mainnet.taiko.xyz/s2/user/rank?address=${address}`,
      {
        headers,
        timeout: 10000
      }
    );

    if (!response.data || !response.data.breakdown) {
      throw new Error('Invalid API response format');
    }

    const breakdown = response.data.breakdown;
    const totalPoints = breakdown.reduce((sum, item) => sum + item.total_points, 0);

    return {
      transactionPoints: breakdown.find(b => b.event === "Transaction")?.total_points || 0,
      valuePoints: breakdown.find(b => b.event === "TransactionValue")?.total_points || 0,
      totalPoints,
      rank: response.data.rank,
      total: response.data.total,
      multiplier: response.data.multiplier
    };
  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`API Error (${error.response.status}): ${error.response.statusText}`));
      console.error(chalk.red(`Error details: ${JSON.stringify(error.response.data)}`));
    } else if (error.request) {
      console.error(chalk.red(`Network Error: No response received - ${error.message}`));
    } else {
      console.error(chalk.red(`Failed to fetch points for ${address}: ${error.message}`));
    }
    await sleep(2000);
    return null;
  }
}

async function waitForAllConfirmations(transactions, requiredConfirmations) {
  const confirmationStates = new Map(
    transactions.map(({ hash, walletIndex }) => [hash, { confirmations: 0, walletIndex }])
  );

  process.stdout.write(chalk.yellow(`\n${"-".repeat(100)}\n⏳ Waiting for confirmations...\n`));

  const confirmedReceipts = [];

  while (confirmationStates.size > 0) {
    try {
      let statusLine = "";

      await Promise.all(
        Array.from(confirmationStates.entries()).map(async ([txHash, state]) => {
          const receipt = await provider.getTransactionReceipt(txHash);

          if (!receipt || !receipt.blockNumber) {
            statusLine += chalk.yellow(`[Wallet-${state.walletIndex + 1}: Pending] `);
            return;
          }

          const currentBlock = await provider.getBlockNumber();
          const confirmations = Math.max(currentBlock - receipt.blockNumber + 1, 0);

          if (confirmations >= requiredConfirmations) {
            confirmationStates.delete(txHash);
            confirmedReceipts.push({ receipt, walletIndex: state.walletIndex });
          } else {
            statusLine += chalk.yellow(`[Wallet-${state.walletIndex + 1}: ${confirmations}/${requiredConfirmations}] `);
          }
        })
      );

      process.stdout.write(`\r${" ".repeat(100)}\r${statusLine}`);

      if (confirmationStates.size > 0) {
        await sleep(5000);
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error checking confirmations: ${error}`));
      await sleep(5000);
    }
  }

  console.log(chalk.green(`\n✓ All transactions confirmed!\n${"-".repeat(100)}`));
  return confirmedReceipts;
}

async function executeTransactions(operations, description) {
  const transactions = [];

  console.log(chalk.cyan(`\n📤 Executing ${description}...`));

  await Promise.all(
    operations.map(async ({ operation, walletIndex }) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const tx = await operation();
          console.log(chalk.yellow(`🔄 Wallet-${walletIndex + 1} ${description} Hash:`), chalk.blue(tx.hash));
          transactions.push({ hash: tx.hash, walletIndex });
          break;
        } catch (error) {
          logWithBorder(chalk.red(`✗ Wallet-${walletIndex + 1} - Attempt ${attempt} failed: ${error.message}`));

          if (attempt === MAX_RETRIES) {
            throw new Error(`Wallet-${walletIndex + 1} - Failed after ${MAX_RETRIES} attempts: ${error.message}`);
          }

          console.log(chalk.yellow(`⏳ Waiting ${RETRY_DELAY / 1000} seconds before retry...`));
          await sleep(RETRY_DELAY);
        }
      }
    })
  );

  const confirmedReceipts = await waitForAllConfirmations(transactions, REQUIRED_CONFIRMATIONS);

  // Calculate fees only from confirmed transaction receipts
  confirmedReceipts.forEach(({ receipt, walletIndex }) => {
    const actualFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const currentWalletFee = walletFees.get(walletIndex) || ethers.BigNumber.from(0);
    walletFees.set(walletIndex, currentWalletFee.add(actualFee));
  });

  return confirmedReceipts;
}

async function processWallets(walletConfigs, iteration) {
  logWithBorder(
    chalk.cyan(`📌 [${getCurrentServerTime()}] Starting iteration ${iteration + 1}`)
  );

  // Initialize wallet info
  const walletInfos = await Promise.all(
    walletConfigs.map(async ({ privateKey, config: walletConfig }, index) => {
      const wallet = new ethers.Wallet(privateKey, provider);
      const points = await fetchTaikoPoints(wallet.address);
      const balance = await provider.getBalance(wallet.address);

      console.log(chalk.cyan(`\n🔷 Wallet-${index + 1} Status:`));
      if (points) {
        console.log(chalk.blue("📊 Initial Points:"), chalk.yellow(points.totalPoints.toFixed(2)));
        console.log(chalk.blue("🏆 Current Rank:"), chalk.yellow(points.rank));
      }
      console.log(chalk.blue("💎 Current balance:"), chalk.yellow(ethers.utils.formatEther(balance)), "ETH");
      console.log(chalk.blue("⚙️ Configured amount range:"),
        chalk.yellow(`${walletConfig.amount_min} - ${walletConfig.amount_max}`), "ETH");

      return { wallet, points, balance, index, config: walletConfig };
    })
  );

  // Prepare deposit operations
  const depositOperations = walletInfos.map(({ wallet, balance, index, config: walletConfig }) => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, JSON.parse(fs.readFileSync("abi.json", "utf8")), wallet);
    const min = ethers.utils.parseEther(walletConfig.amount_min);
    const max = ethers.utils.parseEther(walletConfig.amount_max);
    const randomAmount = ethers.BigNumber.from(ethers.utils.randomBytes(32))
      .mod(max.sub(min))
      .add(min);

    console.log(
      chalk.blue(`🎲 Wallet-${index + 1} Random deposit amount:`),
      chalk.yellow(ethers.utils.formatEther(randomAmount)),
      "ETH"
    );

    if (balance.lt(randomAmount)) {
      console.log(chalk.red(`⚠️ Wallet-${index + 1}: Insufficient balance for deposit`));
      return null;
    }

    return {
      operation: () =>
        contract.deposit({
          value: randomAmount,
          gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
          gasLimit: 104817,
        }),
      walletIndex: index,
    };
  }).filter(Boolean);

  // Execute deposits
  if (depositOperations.length > 0) {
    await executeTransactions(depositOperations, "Deposit");
  }

  await sleep(config.interval * 1000);

  // Prepare withdraw operations
  const withdrawOperations = await Promise.all(
    walletInfos.map(async ({ wallet, index }) => {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, JSON.parse(fs.readFileSync("abi.json", "utf8")), wallet);
      const wethBalance = await contract.balanceOf(wallet.address);

      console.log(
        chalk.blue(`💎 Wallet-${index + 1} WETH balance:`),
        chalk.yellow(ethers.utils.formatEther(wethBalance)),
        "WETH"
      );

      if (wethBalance.isZero()) {
        console.log(chalk.red(`⚠️ Wallet-${index + 1}: No WETH balance to withdraw`));
        return null;
      }

      return {
        operation: () =>
          contract.withdraw(wethBalance, {
            gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
            gasLimit: 100000,
          }),
        walletIndex: index,
      };
    })
  );

  // Execute withdrawals
  const validWithdrawOperations = withdrawOperations.filter(Boolean);
  if (validWithdrawOperations.length > 0) {
    await executeTransactions(validWithdrawOperations, "Withdraw");
  }

  // Wait for API update and fetch final points
  await sleep(5000);

  await Promise.all(
    walletInfos.map(async ({ wallet, points: initialPoints, index }) => {
      const finalPoints = await fetchTaikoPoints(wallet.address);
      if (finalPoints && initialPoints) {
        const pointsDifference = finalPoints.totalPoints - initialPoints.totalPoints;
        console.log(chalk.blue(`📊 Wallet-${index + 1} Points earned:`), chalk.green(`+${pointsDifference.toFixed(2)}`));
        console.log(
          chalk.blue(`🏆 Wallet-${index + 1} New Rank:`),
          chalk.yellow(finalPoints.rank),
          finalPoints.rank < initialPoints.rank
            ? chalk.green(`(↑${initialPoints.rank - finalPoints.rank})`)
            : ""
        );

        if (!walletPoints.has(wallet.address)) {
          walletPoints.set(wallet.address, []);
        }
        walletPoints.get(wallet.address).push({
          iteration: iteration + 1,
          pointsEarned: pointsDifference,
          totalPoints: finalPoints.totalPoints,
          rank: finalPoints.rank,
          rankChange: initialPoints.rank - finalPoints.rank
        });
      }
    })
  );

  completedIterations++;
}

async function sendFinalReport() {
  const ethToUsdRate = await getEthToUsdRate();
  let feesReport = '\n\n<b>💰 Fee Summary per Wallet:</b>';
  let totalFeesUsd = 0;

  // Generate per-wallet fee report using only actual confirmed transaction fees
  for (const [walletIndex, feeWei] of walletFees.entries()) {
    const feeEth = Number(ethers.utils.formatEther(feeWei)).toFixed(8); // High precision for accurate fee display
    const feeUsd = ethToUsdRate ? (parseFloat(feeEth) * ethToUsdRate).toFixed(2) : null;

    if (feeUsd) {
      totalFeesUsd += parseFloat(feeUsd);
    }

    feesReport += `\n• Wallet-${walletIndex + 1}: ${feeEth} ETH${feeUsd ? ` ($${feeUsd})` : ''}`;
  }

  const notificationMessage = `
<b>🎉 Tugas Otomatis Selesai</b>

Halo! Saya senang memberitahu Anda bahwa tugas otomatis telah selesai dilaksanakan.

<b>📊 Ringkasan:</b>
• Total Iterasi Berhasil: ${completedIterations}
• Jumlah Wallet: ${getWalletConfigs().length}
• Waktu Selesai: ${getCurrentServerTime()}
${feesReport}

<b>🎯 Points Summary per Wallet:</b>
${Array.from(walletPoints.entries()).map(([address, points]) => {
    const totalPointsEarned = points.reduce((sum, p) => sum + p.pointsEarned, 0);
    const latestPoints = points[points.length - 1];
    const rankChange = points[0].rank - latestPoints.rank;

    return `\n<code>${address.substring(0, 6)}...${address.slice(-4)}</code>:
• Total Points Earned: ${totalPointsEarned.toFixed(2)}
• Final Total Points: ${latestPoints.totalPoints.toFixed(2)}
• Rank Change: ${rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "No change"}
• Current Rank: ${latestPoints.rank}`;
  }).join('')}

Semua operasi deposit dan penarikan telah selesai dilakukan sesuai dengan konfigurasi yang ditetapkan.

Terima kasih atas perhatian Anda. Jika ada pertanyaan atau masalah, jangan ragu untuk menghubungi tim dukungan @caraka17.

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>`;

  await sendTelegramNotification(notificationMessage);
}

async function main() {
  const iterations = config.iterations || 70;
  const walletConfigs = getWalletConfigs();

  isOperationRunning = true;
  completedIterations = 0;
  walletFees.clear(); // Clear previous wallet fees

  logWithBorder(
    chalk.cyan(`🚀 [${getCurrentServerTime()}] Starting operations with configuration:`)
  );

  // Log konfigurasi per wallet
  console.log(chalk.yellow("Wallet Configurations:"));
  walletConfigs.forEach(({ config: walletConfig }, index) => {
    console.log(chalk.yellow(`Wallet-${index + 1}:`));
    console.log(chalk.yellow(JSON.stringify(walletConfig, null, 2)));
  });

  for (let i = 0; i < iterations; i++) {
    await processWallets(walletConfigs, i);

    if (i < iterations - 1) {
      logWithBorder(
        chalk.yellow(`⏳ Waiting ${config.interval} seconds before next iteration...`),
        "-"
      );
      await sleep(config.interval * 1000);
    }
  }

  await sendFinalReport();
  isOperationRunning = false;
}

function scheduleTask() {
  const timezone = config.timezone || "Asia/Jakarta";
  const scheduledTime = config.scheduledTime || "07:00";
  const [scheduledHour, scheduledMinute] = scheduledTime.split(":").map(Number);

  logWithBorder(
    chalk.cyan(`⚙️ [${getCurrentServerTime()}] Current configuration:`)
  );
  console.log(
    chalk.yellow(JSON.stringify(
      { ...config, wallets: `${getWalletConfigs().length} wallets` },
      null,
      2
    ))
  );

  logWithBorder(
    chalk.cyan(`🕒 [${getCurrentServerTime()}] Scheduling task to run at ${scheduledTime} ${timezone}`)
  );

  const job = schedule.scheduleJob(
    { hour: scheduledHour, minute: scheduledMinute, tz: timezone },
    function () {
      logWithBorder(
        chalk.green(`✨ [${getCurrentServerTime()}] Starting scheduled task...`)
      );
      main().catch(console.error);
    }
  );

  console.log(
    chalk.cyan(`\n⏳ [${getCurrentServerTime()}] Task scheduled. Waiting for execution time...`)
  );

  function updateCountdown() {
    if (!isOperationRunning) {
      const now = moment().tz(timezone);
      let nextExecution = moment()
        .tz(timezone)
        .set({ hour: scheduledHour, minute: scheduledMinute, second: 0 });

      if (nextExecution.isSameOrBefore(now)) {
        nextExecution.add(1, "day");
      }

      const duration = moment.duration(nextExecution.diff(now));
      const hours = duration.hours().toString().padStart(2, "0");
      const minutes = duration.minutes().toString().padStart(2, "0");
      const seconds = duration.seconds().toString().padStart(2, "0");

      process.stdout.write(
        chalk.cyan(`\r⏳ [${getCurrentServerTime()}] Next execution in: ${chalk.yellow(`${hours}:${minutes}:${seconds}`)}`)
      );
    }
  }

  updateCountdown();
  const countdownInterval = setInterval(updateCountdown, 1000);

  job.on("scheduled", function () {
    clearInterval(countdownInterval);
    logWithBorder(
      chalk.green(`✓ [${getCurrentServerTime()}] Task executed.`)
    );
    scheduleTask();
  });
}

scheduleTask();

process.on("SIGINT", function () {
  logWithBorder(
    chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
  );
  process.exit();
});