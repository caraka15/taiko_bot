// weth.js
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
let totalFeesWei = ethers.BigNumber.from(0);

const REQUIRED_CONFIRMATIONS = config.confirmation.required;
const MAX_RETRIES = config.confirmation.maxRetries;
const RETRY_DELAY = config.confirmation.retryDelay;

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

function logWithBorder(message, borderChar = "=") {
  const line = borderChar.repeat(100);
  console.log(chalk.yellow(`\n${line}`));
  console.log(message);
  console.log(chalk.yellow(line));
}

function getPrivateKeys() {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("PRIVATE_KEY_"))
    .map((key) => process.env[key]);
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
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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

async function waitForConfirmations(txHash, requiredConfirmations) {
  process.stdout.write(chalk.yellow(`\n${"-".repeat(100)}\n⏳ Loading`));

  while (true) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt || !receipt.blockNumber) {
        process.stdout.write(chalk.yellow(`\r⏳ Transaction pending...`));
        await sleep(5000);
        continue;
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = Math.max(currentBlock - receipt.blockNumber + 1, 0);

      if (confirmations < 0) {
        console.error(chalk.red(`\n✗ Error: Invalid confirmation count (${confirmations}). Retrying...`));
        await sleep(5000);
        continue;
      }

      process.stdout.write(chalk.yellow(`\r⏳ Confirmations Blocks ${confirmations}/${requiredConfirmations}`));

      if (confirmations >= requiredConfirmations) {
        process.stdout.write(chalk.green(`\n✓ Required confirmations (${requiredConfirmations}) reached!\n`));
        console.log(chalk.yellow("-".repeat(100)));
        return receipt;
      }

      await sleep(5000);
    } catch (error) {
      console.error(chalk.red(`\n✗ Error checking confirmations: ${error}`));
      await sleep(5000);
    }
  }
}

async function executeTransaction(operation, description) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logWithBorder(chalk.cyan(`📝 ${description} - Attempt ${attempt} of ${MAX_RETRIES}`));
      const tx = await operation();
      console.log(chalk.yellow(`🔄 ${description} - Transaction Hash:`), chalk.blue(tx.hash));

      const receipt = await waitForConfirmations(tx.hash, REQUIRED_CONFIRMATIONS);
      console.log(chalk.green(`✓ ${description} - Confirmed in block:`), chalk.blue(receipt.blockNumber));

      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const fee = gasUsed.mul(gasPrice);
      console.log(chalk.magenta(`💰 ${description} - Transaction fee:`), chalk.yellow(ethers.utils.formatEther(fee)), "ETH");

      return { receipt, fee };
    } catch (error) {
      logWithBorder(chalk.red(`✗ ${description} - Attempt ${attempt} failed: ${error.message}`));

      if (attempt === MAX_RETRIES) {
        throw new Error(`${description} - Failed after ${MAX_RETRIES} attempts: ${error.message}`);
      }

      console.log(chalk.yellow(`⏳ Waiting ${RETRY_DELAY / 1000} seconds before retry...`));
      await sleep(RETRY_DELAY);
    }
  }
}

async function processWallet(privateKey, iteration, walletIndex, interval) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const contractABI = JSON.parse(fs.readFileSync("abi.json", "utf8"));
  const contractAddress = process.env.CONTRACT_ADDRESS || "0xA51894664A773981C6C112C43ce576f315d5b1B6";
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);

  logWithBorder(
    chalk.cyan(`🔷 [${getCurrentServerTime()}] Processing wallet ${walletIndex + 1} - Iteration ${iteration + 1}`)
  );

  try {
    const balance = await provider.getBalance(wallet.address);
    console.log(chalk.blue("💎 Current balance:"), chalk.yellow(ethers.utils.formatEther(balance)), "ETH");

    const min = ethers.utils.parseEther(config.amount_min);
    const max = ethers.utils.parseEther(config.amount_max);
    const randomAmount = ethers.BigNumber.from(ethers.utils.randomBytes(32))
      .mod(max.sub(min))
      .add(min);

    console.log(chalk.blue("🎲 Random deposit amount:"), chalk.yellow(ethers.utils.formatEther(randomAmount)), "ETH");

    if (balance.lt(randomAmount)) {
      logWithBorder(chalk.red("⚠️ Insufficient balance for deposit"));
      return false;
    }

    const depositResult = await executeTransaction(
      async () => {
        return contract.deposit({
          value: randomAmount,
          gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
          gasLimit: 104817,
        });
      },
      "Deposit"
    );

    totalFeesWei = totalFeesWei.add(depositResult.fee);

    logWithBorder(chalk.yellow(`⏳ Waiting ${interval} seconds before withdraw...`));
    await sleep(interval * 1000);

    const wethBalance = await contract.balanceOf(wallet.address);
    console.log(chalk.blue("💎 Current WETH balance:"), chalk.yellow(ethers.utils.formatEther(wethBalance)), "WETH");

    if (wethBalance.isZero()) {
      logWithBorder(chalk.red("⚠️ No WETH balance to withdraw"));
      return false;
    }

    const withdrawResult = await executeTransaction(
      async () => {
        return contract.withdraw(wethBalance, {
          gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
          gasLimit: 100000,
        });
      },
      "Withdraw"
    );

    totalFeesWei = totalFeesWei.add(withdrawResult.fee);
    completedIterations++;
    return true;

  } catch (error) {
    logWithBorder(chalk.red(`✗ Wallet processing failed: ${error.message}`));
    return false;
  }
}

async function main() {
  const iterations = config.iterations || 70;
  const interval = config.interval || 1;
  const privateKeys = getPrivateKeys();

  isOperationRunning = true;
  completedIterations = 0;
  totalFeesWei = ethers.BigNumber.from(0);

  logWithBorder(
    chalk.cyan(`🚀 [${getCurrentServerTime()}] Starting operations with configuration:`)
  );
  console.log(
    chalk.yellow(JSON.stringify(
      { ...config, wallets: `${privateKeys.length} wallets` },
      null,
      2
    ))
  );

  for (let i = 0; i < iterations; i++) {
    logWithBorder(
      chalk.cyan(`📌 [${getCurrentServerTime()}] Starting iteration ${i + 1} of ${iterations}`)
    );

    for (let j = 0; j < privateKeys.length; j++) {
      const success = await processWallet(privateKeys[j], i, j, interval);

      if (success && j < privateKeys.length - 1) {
        logWithBorder(
          chalk.yellow(`⏳ Waiting ${interval} seconds before next wallet...`),
          "-"
        );
        await sleep(interval * 1000);
      }
    }

    if (i < iterations - 1) {
      logWithBorder(
        chalk.yellow(`⏳ Waiting ${interval} seconds before next iteration...`),
        "-"
      );
      await sleep(interval * 1000);
    }
  }

  await sendFinalReport();
  isOperationRunning = false;
}

async function sendFinalReport() {
  const totalFeesEth = ethers.utils.formatEther(totalFeesWei);
  const ethToUsdRate = await getEthToUsdRate();
  let feeMessage = `${Number(totalFeesEth).toFixed(5)} ETH`;

  if (ethToUsdRate) {
    const totalFeesUsd = (parseFloat(totalFeesEth) * ethToUsdRate).toFixed(2);
    feeMessage += ` ($${totalFeesUsd})`;
  }

  const notificationMessage = `
<b>🎉 Tugas Otomatis Selesai</b>

Halo! Saya senang memberitahu Anda bahwa tugas otomatis telah selesai dilaksanakan.

<b>📊 Ringkasan:</b>
• Total Iterasi Berhasil: ${completedIterations}
• Jumlah Wallet: ${getPrivateKeys().length}
• Waktu Selesai: ${getCurrentServerTime()}
• Total Biaya Transaksi: ${feeMessage}

Semua operasi deposit dan penarikan telah selesai dilakukan sesuai dengan konfigurasi yang ditetapkan.

Terima kasih atas perhatian Anda. Jika ada pertanyaan atau masalah, jangan ragu untuk menghubungi tim dukungan @caraka17.

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>
`;

  await sendTelegramNotification(notificationMessage);
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
      { ...config, wallets: `${getPrivateKeys().length} wallets` },
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