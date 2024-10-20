// weth.js
require("dotenv").config();
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const axios = require("axios");
const { ethers } = require("ethers");

const execPromise = util.promisify(exec);
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
let isOperationRunning = false;
let completedIterations = 0;
let totalFeesWei = ethers.BigNumber.from(0);

function getPrivateKeys() {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("PRIVATE_KEY_"))
    .map((key) => process.env[key]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCurrentServerTime() {
  return moment()
    .tz(config.timezone || "Asia/Jakarta")
    .format("YYYY-MM-DD HH:mm:ss");
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
    console.log("Telegram notification sent successfully");
  } catch (error) {
    console.error("Failed to send Telegram notification:", error.message);
  }
}

async function getEthToUsdRate() {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
    );
    return response.data.ethereum.usd;
  } catch (error) {
    console.error("Failed to fetch ETH to USD rate:", error.message);
    return null;
  }
}

async function runCommand(command, env) {
  try {
    const { stdout, stderr } = await execPromise(command, {
      env: { ...process.env, ...env },
    });
    return {
      output: stdout,
      error: stderr,
      retval: 0,
    };
  } catch (error) {
    return {
      output: error.stdout,
      error: error.stderr,
      retval: error.code,
    };
  }
}

function extractFeeFromOutput(output) {
  const feeMatch = output.match(/Transaction fee: (\d+(\.\d+)?) ETH/);
  if (feeMatch) {
    return ethers.utils.parseEther(feeMatch[1]);
  }
  return null;
}

async function processWallet(privateKey, iteration, walletIndex, interval) {
  const env = { PRIVATE_KEY: privateKey };
  console.log(
    `[${getCurrentServerTime()}] Processing wallet ${
      walletIndex + 1
    } - Iteration ${iteration + 1}`
  );

  // Deposit
  console.log("Running deposit...");
  const depositResult = await runCommand("node weth_deposit.js", env);
  console.log(depositResult.output);

  if (depositResult.retval === 0) {
    const depositFee = extractFeeFromOutput(depositResult.output);
    if (depositFee) {
      totalFeesWei = totalFeesWei.add(depositFee);
    }

    // Wait after deposit
    console.log(`Waiting ${interval} seconds before withdraw...`);
    await sleep(interval * 1000);

    // Withdraw
    console.log("Running withdraw...");
    const withdrawResult = await runCommand("node weth_withdraw.js", env);
    console.log(withdrawResult.output);

    if (withdrawResult.retval === 0) {
      const withdrawFee = extractFeeFromOutput(withdrawResult.output);
      if (withdrawFee) {
        totalFeesWei = totalFeesWei.add(withdrawFee);
      }
      completedIterations++;
      return true;
    }
  }
  return false;
}

async function main() {
  const iterations = config.iterations || 70;
  const interval = config.interval || 30;
  const privateKeys = getPrivateKeys();

  isOperationRunning = true;
  completedIterations = 0;
  totalFeesWei = ethers.BigNumber.from(0);

  console.log(
    `[${getCurrentServerTime()}] Starting operations with configuration:`
  );
  console.log(
    JSON.stringify(
      { ...config, wallets: `${privateKeys.length} wallets` },
      null,
      2
    )
  );

  for (let i = 0; i < iterations; i++) {
    console.log(
      `[${getCurrentServerTime()}] Starting iteration ${i + 1} of ${iterations}`
    );

    for (let j = 0; j < privateKeys.length; j++) {
      const success = await processWallet(privateKeys[j], i, j, interval);

      if (success && j < privateKeys.length - 1) {
        console.log(`Waiting ${interval} seconds before next wallet...`);
        await sleep(interval * 1000);
      }
    }

    if (i < iterations - 1) {
      console.log(`Waiting ${interval} seconds before next iteration...`);
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

  console.log(`[${getCurrentServerTime()}] Current configuration:`);
  console.log(
    JSON.stringify(
      { ...config, wallets: `${getPrivateKeys().length} wallets` },
      null,
      2
    )
  );

  console.log(
    `[${getCurrentServerTime()}] Scheduling task to run at ${scheduledTime} ${timezone}`
  );

  const job = schedule.scheduleJob(
    { hour: scheduledHour, minute: scheduledMinute, tz: timezone },
    function () {
      console.log(`[${getCurrentServerTime()}] Starting scheduled task...`);
      main().catch(console.error);
    }
  );

  console.log(
    `[${getCurrentServerTime()}] Task scheduled. Waiting for execution time...`
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
        `\r[${getCurrentServerTime()}] Next execution in: ${hours}:${minutes}:${seconds}`
      );
    }
  }

  updateCountdown();
  const countdownInterval = setInterval(updateCountdown, 1000);

  job.on("scheduled", function () {
    clearInterval(countdownInterval);
    console.log("\n" + `[${getCurrentServerTime()}] Task executed.`);
    scheduleTask();
  });
}

// Start scheduling task
scheduleTask();

// Handle program termination
process.on("SIGINT", function () {
  console.log(`\n[${getCurrentServerTime()}] Script terminated.`);
  process.exit();
});
