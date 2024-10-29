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

function scheduleTask() {
    // Cleanup sebelum membuat job baru
    cleanupJob();

    const timezone = config.timezone || "Asia/Jakarta";
    const scheduledTime = config.scheduledTime || "07:00";
    const [scheduledHour, scheduledMinute] = scheduledTime.split(":").map(Number);

    logWithBorder(
        chalk.cyan(`⚙️ [${getCurrentServerTime()}] Current configuration:`)
    );
    console.log(
        chalk.yellow(JSON.stringify(
            {
                mode: MODE,
                timezone,
                scheduledTime,
                ...config,
                wallets: `${getWalletConfigs().length} wallets`
            },
            null,
            2
        ))
    );

    logWithBorder(
        chalk.cyan(`🕒 [${getCurrentServerTime()}] Scheduling ${MODE.toUpperCase()} task to run at ${scheduledTime} ${timezone}`)
    );

    activeJob = schedule.scheduleJob(
        { hour: scheduledHour, minute: scheduledMinute, tz: timezone },
        function () {
            logWithBorder(
                chalk.green(`✨ [${getCurrentServerTime()}] Starting scheduled task...`)
            );
            main().catch(console.error);
        }
    );

    countdownInterval = updateCountdown(scheduledHour, scheduledMinute, timezone);

    activeJob.on("scheduled", function () {
        cleanupJob();
        scheduleTask();
    });

    return activeJob;
}

// ... rest of the code (updateCountdown function) remains the same ...

// Tambahkan handler untuk cleanup saat aplikasi dihentikan
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