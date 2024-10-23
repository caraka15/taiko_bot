const schedule = require('node-schedule');
const { getCurrentServerTime, moment, sleep } = require('../utils/time');
const { logWithBorder } = require('../utils/logger');
const { chalk } = require('../utils/logger');
const { processWallets } = require('./transaction');
const { getWalletConfigs } = require('../utils/wallet');
const { generateFinalReport, sendTelegramNotification } = require('../services/telegram');
const config = require('../../config/config.json');
const { walletFees, walletPoints } = require('./transaction');

let isOperationRunning = false;
let completedIterations = 0;

async function main() {
    const iterations = config.iterations || 70;
    const walletConfigs = getWalletConfigs();

    isOperationRunning = true;
    completedIterations = 0; // Reset at start
    walletFees.clear();

    logWithBorder(
        chalk.cyan(`🚀 [${getCurrentServerTime()}] Starting operations with configuration:`)
    );

    console.log(chalk.yellow("Wallet Configurations:"));
    walletConfigs.forEach(({ config: walletConfig }, index) => {
        console.log(chalk.yellow(`Wallet-${index + 1}:`));
        console.log(chalk.yellow(JSON.stringify(walletConfig, null, 2)));
    });

    try {
        for (let i = 0; i < iterations; i++) {
            await processWallets(walletConfigs, i);
            completedIterations++; // Increment after each successful iteration

            if (i < iterations - 1) {
                logWithBorder(
                    chalk.yellow(`⏳ Waiting ${config.interval} seconds before next iteration...`),
                    "-"
                );
                await sleep(config.interval * 1000);
            }
        }
    } catch (error) {
        console.error(chalk.red(`Error in main execution: ${error.message}`));
    }

    const finalReport = await generateFinalReport(walletPoints, walletFees, completedIterations);
    await sendTelegramNotification(finalReport);
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

    const countdownInterval = updateCountdown(scheduledHour, scheduledMinute, timezone);

    job.on("scheduled", function () {
        clearInterval(countdownInterval);
        logWithBorder(
            chalk.green(`✓ [${getCurrentServerTime()}] Task executed.`)
        );
        scheduleTask();
    });

    return job;
}

function updateCountdown(scheduledHour, scheduledMinute, timezone) {
    function update() {
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

    update();
    return setInterval(update, 1000);
}

module.exports = {
    scheduleTask,
    main
};