require('dotenv').config();
const { scheduleTask } = require('./core/scheduler');
const { logWithBorder } = require('./utils/logger');
const { chalk } = require('./utils/logger');
const { getCurrentServerTime } = require('./utils/time');

// Start the application
scheduleTask();

// Handle termination
process.on("SIGINT", function () {
    logWithBorder(
        chalk.red(`👋 [${getCurrentServerTime()}] Script terminated.`)
    );
    process.exit();
});