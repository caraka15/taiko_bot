const chalk = require('chalk');

function logWithBorder(message, borderChar = "=") {
    const line = borderChar.repeat(100);
    console.log(chalk.yellow(`\n${line}`));
    console.log(message);
    console.log(chalk.yellow(line));
}

module.exports = {
    logWithBorder,
    chalk
};