const moment = require('moment-timezone');
const { chalk } = require('./logger');
const config = require('../../config/config.json');

function getCurrentServerTime(noColor = false) {
    const timeString = moment()
        .tz(config.timezone || "Asia/Jakarta")
        .format("YYYY-MM-DD HH:mm:ss");

    return noColor ? timeString : chalk.gray(timeString);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    getCurrentServerTime,
    sleep,
    moment
};