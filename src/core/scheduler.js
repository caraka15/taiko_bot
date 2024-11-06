const schedule = require('node-schedule');
const { getCurrentServerTime, moment, sleep } = require('../utils/time');
const { logWithBorder } = require('../utils/logger');
const { chalk } = require('../utils/logger');
const { processWallets, walletPoints: wethPoints, walletFees: wethFees } = require('./transaction');
const { processVoteWallets, walletPoints: votePoints, walletFees: voteFees } = require('./vote');
const { getWalletConfigs } = require('../utils/wallet');
const { generateFinalReport, sendTelegramNotification } = require('../services/telegram');
const config = require('../../config/config.json');

let isOperationRunning = false;
let completedIterations = 0;
let activeJob = null;
let countdownInterval = null;

const MODE = process.env.MODE || 'weth';

async function main() {
    // Validasi mode
    if (!['weth', 'vote'].includes(MODE)) {
        throw new Error(`Invalid mode: ${MODE}. Must be either 'weth' or 'vote'`);
    }

    // Ambil config sesuai mode
    const modeConfig = MODE === 'weth' ? config.weth : config.vote;

    // Log config untuk verifikasi
    console.log('Mode Config:', {
        mode: MODE,
        iterations: modeConfig.iterations,
        interval: modeConfig.interval
    });

    // Validasi iterations sesuai mode
    const iterations = modeConfig.iterations;
    if (!iterations || iterations <= 0) {
        throw new Error(`Invalid iterations for ${MODE} mode: ${iterations}`);
    }

    const walletConfigs = getWalletConfigs();

    // Reset semua state
    isOperationRunning = true;
    completedIterations = 0;

    logWithBorder(
        chalk.cyan(`🚀 [${getCurrentServerTime()}] Starting ${MODE.toUpperCase()} operations with configuration:`)
    );

    // Log detail konfigurasi
    console.log(chalk.yellow('Configuration Details:'));
    console.log(chalk.yellow(`• Mode: ${MODE.toUpperCase()}`));
    console.log(chalk.yellow(`• Iterations: ${iterations}`));
    console.log(chalk.yellow(`• Interval: ${modeConfig.interval} seconds`));

    if (MODE === 'weth') {
        console.log(chalk.yellow(`• Gas Price: ${modeConfig.gasPrice} gwei`));
    } else {
        console.log(chalk.yellow(`• Max Fee: ${modeConfig.maxFee} gwei`));
        console.log(chalk.yellow(`• Max Priority Fee: ${modeConfig.maxPriorityFee} gwei`));
    }

    try {
        // Tentukan points dan fees berdasarkan mode
        const { walletPoints, walletFees } = MODE === 'weth'
            ? { walletPoints: wethPoints, walletFees: wethFees }
            : { walletPoints: votePoints, walletFees: voteFees };

        // Reset points dan fees untuk sesi baru
        walletPoints.clear();
        walletFees.clear();

        for (let i = 0; i < iterations; i++) {
            if (!isOperationRunning) {
                console.log(chalk.yellow("\n⚠️ Operation stopped by user or system"));
                break;
            }

            console.log(chalk.cyan(`\nStarting ${MODE} iteration ${i + 1}/${iterations}`));

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
            const finalReport = await generateFinalReport(walletPoints, walletFees, completedIterations, MODE);
            await sendTelegramNotification(finalReport);
        }

    } catch (error) {
        console.error(chalk.red(`Error in ${MODE} execution: ${error.message}`));
        if (completedIterations > 0) {
            const { walletPoints, walletFees } = MODE === 'weth'
                ? { walletPoints: wethPoints, walletFees: wethFees }
                : { walletPoints: votePoints, walletFees: voteFees };

            const errorReport = await generateFinalReport(walletPoints, walletFees, completedIterations, MODE);
            await sendTelegramNotification(errorReport);
        }
    } finally {
        isOperationRunning = false;
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
    isOperationRunning = false;
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

    // Cleanup any existing jobs
    cleanupJob();

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
        // Reset NOW flag setelah eksekusi
        process.env.NOW = 'false';
    }

    logWithBorder(
        chalk.cyan(`🕒 [${getCurrentServerTime()}] Scheduling task to run at ${scheduledTime} ${timezone}`)
    );

    activeJob = schedule.scheduleJob(
        { hour: scheduledHour, minute: scheduledMinute, tz: timezone },
        function () {
            if (!isOperationRunning) {
                logWithBorder(
                    chalk.green(`✨ [${getCurrentServerTime()}] Starting scheduled task...`)
                );
                main().catch(console.error);
            }
        }
    );

    countdownInterval = updateCountdown(scheduledHour, scheduledMinute, timezone);

    process.on('SIGINT', () => {
        cleanupJob();
        logWithBorder(
            chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
        );
        process.exit(0);
    });

    return activeJob;
}

module.exports = {
    scheduleTask,
    main
};