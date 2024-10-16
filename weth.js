require("dotenv").config();
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs");
const schedule = require("node-schedule");
const moment = require("moment-timezone");
const axios = require("axios");
const { ethers } = require("ethers");

const execPromise = util.promisify(exec);

// Read configuration
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Function to get all private keys from .env
function getPrivateKeys() {
  return Object.keys(process.env)
    .filter((key) => key.startsWith("PRIVATE_KEY_"))
    .map((key) => process.env[key]);
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

async function main() {
  const iterations = config.iterations || 70;
  const interval = config.interval || 30;
  const privateKeys = getPrivateKeys();
  let totalFeesWei = ethers.BigNumber.from(0);

  for (let i = 0; i < iterations; i++) {
    console.log(
      `[${getCurrentServerTime()}] Iteration ${i + 1} of ${iterations}`
    );

    for (let j = 0; j < privateKeys.length; j++) {
      const privateKey = privateKeys[j];
      console.log(
        `[${getCurrentServerTime()}] Processing wallet ${j + 1} of ${
          privateKeys.length
        }`
      );

      const env = { PRIVATE_KEY: privateKey };

      console.log("Running deposit...");
      const depositResult = await runCommand("node weth_deposit.js", env);
      console.log(depositResult.output);

      if (depositResult.retval === 0) {
        // Extract and add deposit fee
        const depositFee = extractFeeFromOutput(depositResult.output);
        if (depositFee) {
          totalFeesWei = totalFeesWei.add(depositFee);
        }

        console.log(
          `Deposit successful for wallet ${
            j + 1
          }, waiting for ${interval} seconds...`
        );
        await sleep(interval * 1000);

        console.log("Running withdraw...");
        const withdrawResult = await runCommand("node weth_withdraw.js", env);
        console.log(withdrawResult.output);

        if (withdrawResult.retval === 0) {
          // Extract and add withdraw fee
          const withdrawFee = extractFeeFromOutput(withdrawResult.output);
          if (withdrawFee) {
            totalFeesWei = totalFeesWei.add(withdrawFee);
          }
          console.log(`Withdraw successful for wallet ${j + 1}.`);
        } else {
          console.log(`Withdraw failed for wallet ${j + 1}.`);
        }
      } else {
        console.log(`Deposit failed for wallet ${j + 1}.`);
      }

      if (j < privateKeys.length - 1) {
        console.log(
          `Waiting for ${interval} seconds before processing next wallet...`
        );
        await sleep(interval * 1000);
      }
    }

    if (i < iterations - 1) {
      console.log(`Waiting for ${interval} seconds before next iteration...`);
      await sleep(interval * 1000);
    }
  }

  console.log(
    `[${getCurrentServerTime()}] All iterations completed for all wallets.`
  );

  const totalFeesEth = ethers.utils.formatEther(totalFeesWei);
  const ethToUsdRate = await getEthToUsdRate();
  let feeMessage = `${totalFeesEth} ETH`;

  if (ethToUsdRate) {
    const totalFeesUsd = (parseFloat(totalFeesEth) * ethToUsdRate).toFixed(2);
    feeMessage += ` ($${totalFeesUsd})`;
  }

  // Send Telegram notification after all iterations are complete
  const notificationMessage = `
<b>🎉 Tugas Otomatis Selesai</b>

Halo! Saya senang memberitahu Anda bahwa tugas otomatis telah selesai dilaksanakan.

<b>📊 Ringkasan:</b>
• Total Iterasi: ${iterations}
• Jumlah Wallet: ${privateKeys.length}
• Waktu Selesai: ${getCurrentServerTime()}
• Total Biaya Transaksi: ${feeMessage}

Semua operasi deposit dan penarikan telah berhasil dilakukan sesuai dengan konfigurasi yang ditetapkan. Jika Anda ingin melihat detail lebih lanjut, silakan periksa log aplikasi.

Terima kasih atas perhatian Anda. Jika ada pertanyaan atau masalah, jangan ragu untuk menghubungi tim dukungan @caraka17.

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>
  `;

  await sendTelegramNotification(notificationMessage);
}

function extractFeeFromOutput(output) {
  const feeMatch = output.match(/Transaction fee: (\d+(\.\d+)?) ETH/);
  if (feeMatch) {
    return ethers.utils.parseEther(feeMatch[1]);
  }
  return null;
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

  const now = moment().tz(timezone);
  const nextExecution = moment()
    .tz(timezone)
    .set({ hour: scheduledHour, minute: scheduledMinute });
  if (nextExecution.isBefore(now)) {
    nextExecution.add(1, "day");
  }
  const timeUntilExecution = nextExecution.diff(now);
  console.log(
    `Next execution will be in approximately ${moment
      .duration(timeUntilExecution)
      .humanize()}`
  );
}

scheduleTask();

process.on("SIGINT", function () {
  console.log(`[${getCurrentServerTime()}] Script terminated.`);
  process.exit();
});
