const schedule = require('node-schedule');
const { getCurrentServerTime, moment, sleep } = require('../utils/time');
const { logWithBorder } = require('../utils/logger');
const { chalk } = require('../utils/logger');
const { processWallets } = require('./transaction');
const { processVoteWallets } = require('./vote');
const { getWalletConfigs } = require('../utils/wallet');
const { generateFinalReport, sendTelegramNotification } = require('../services/telegram');
const config = require('../../config/config.json');

let isOperationRunning = false;
let completedIterations = 0;
let activeJob = null;
let countdownInterval = null;

const MODE = process.env.MODE || 'weth';

// Fungsi untuk reset semua data
function resetData() {
    completedIterations = 0;
    isOperationRunning = false;

    // Reset data dari modul transaction dan vote
    const { walletFees: wethFees, walletPoints: wethPoints } = require('./transaction');
    const { walletFees: voteFees, walletPoints: votePoints } = require('./vote');

    wethFees.clear();
    wethPoints.clear();
    voteFees.clear();
    votePoints.clear();
}

async function main() {
    // Reset data setiap kali main dijalankan
    resetData();

    const modeConfig = MODE === 'weth' ? config.weth : config.vote;
    const iterations = modeConfig.iterations;
    const walletConfigs = getWalletConfigs();

    isOperationRunning = true;

    logWithBorder(
        chalk.cyan(`🚀 [${getCurrentServerTime()}] Starting ${MODE.toUpperCase()} operations with configuration:`)
    );

    console.log(chalk.yellow(`Mode: ${MODE.toUpperCase()}`));
    console.log(chalk.yellow(`Iterations: ${iterations}`));
    console.log(chalk.yellow(`Interval: ${modeConfig.interval} seconds`));
    console.log(chalk.yellow(`Gas Price: ${modeConfig.gasPrice} gwei`));
    console.log(chalk.yellow("\nWallet Configurations:"));

    if (MODE === 'weth') {
        walletConfigs.forEach(({ config: walletConfig, index }) => {
            console.log(chalk.yellow(`Wallet-${index + 1}:`));
            console.log(chalk.yellow(JSON.stringify(walletConfig, null, 2)));
        });
    } else {
        console.log(chalk.yellow(`Total Wallets: ${walletConfigs.length}`));
        walletConfigs.forEach(({ index }) => {
            console.log(chalk.yellow(`Wallet-${index + 1}: Vote Mode - No amount configuration needed`));
        });
    }

    try {
        for (let i = 0; i < iterations; i++) {
            if (!isOperationRunning) {
                console.log(chalk.yellow("\n⚠️ Operation stopped by user or system"));
                break;
            }

            if (MODE === 'weth') {
                await processWallets(walletConfigs, i);
            } else if (MODE === 'vote') {
                await processVoteWallets(walletConfigs, i);
            }

            completedIterations++;

            if (i < iterations - 1) {
                logWithBorder(
                    chalk.yellow(`⏳ Waiting ${modeConfig.interval} seconds before next iteration...`),
                    "-"
                );
                await sleep(modeConfig.interval * 1000);
            }
        }

        if (completedIterations > 0) {
            const { walletFees, walletPoints } = MODE === 'weth'
                ? require('./transaction')
                : require('./vote');

            const finalReport = await generateFinalReport(walletPoints, walletFees, completedIterations, MODE);
            await sendTelegramNotification(finalReport);
        }
    } catch (error) {
        console.error(chalk.red(`Error in main execution: ${error.message}`));
        if (completedIterations > 0) {
            const { walletFees, walletPoints } = MODE === 'weth'
                ? require('./transaction')
                : require('./vote');
            const errorReport = await generateFinalReport(walletPoints, walletFees, completedIterations, MODE);
            await sendTelegramNotification(errorReport);
        }
    } finally {
        isOperationRunning = false;
        resetData();
    }
}

function cleanupJob() {
    if (activeJob) {
        activeJob.cancel();
        activeJob = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    resetData();
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

async function scheduleTask() {
    const timezone = config.timezone || "Asia/Jakarta";
    const scheduledTime = config.scheduledTime || "07:00";
    const [scheduledHour, scheduledMinute] = scheduledTime.split(":").map(Number);
    const runNow = process.env.NOW === 'true';

    logWithBorder(
        chalk.cyan(`⚙️ [${getCurrentServerTime()}] Current configuration:`)
    );
    console.log(
        chalk.yellow(JSON.stringify(
            {
                mode: MODE,
                timezone,
                scheduledTime,
                runNow,
                ...config,
                wallets: `${getWalletConfigs().length} wallets`
            },
            null,
            2
        ))
    );

    if (runNow) {
        logWithBorder(
            chalk.green(`✨ [${getCurrentServerTime()}] Starting immediate execution...`)
        );
        await main().catch(console.error);
    }

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

// Handle cleanup on process termination
process.on('SIGINT', () => {
    cleanupJob();
    logWithBorder(
        chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
    );
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanupJob();
    logWithBorder(
        chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
    );
    process.exit(0);
});

module.exports = {
    scheduleTask,
    main
};