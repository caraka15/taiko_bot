require('dotenv').config();
const { scheduleTask } = require('./core/scheduler');
const { logWithBorder } = require('./utils/logger');
const { chalk } = require('./utils/logger');
const { getCurrentServerTime } = require('./utils/time');

// Print startup banner
logWithBorder(
    chalk.cyan(`
🚀 Taiko Automation Bot by CrxaNode
Mode: ${process.env.MODE?.toUpperCase() || 'WETH'}
Started at: ${getCurrentServerTime()}
  `)
);

// Start the application
scheduleTask();

// Handle termination
process.on("SIGINT", function () {
    logWithBorder(
        chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
    );
    process.exit();
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled rejection:'), error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(chalk.red('Uncaught exception:'), error);
    process.exit(1);
});