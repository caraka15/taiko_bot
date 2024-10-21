// utils.js
const { ethers } = require("ethers");
const fs = require("fs");

// Load configuration
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Wait for confirmations function
async function waitForConfirmations(provider, txHash, requiredConfirmations) {
    process.stdout.write(`\nWait ${requiredConfirmations} confirmations`);

    while (true) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) {
                process.stdout.write(`\rTransaction pending...`);
                await sleep(5000);
                continue;
            }

            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber + 1;

            // Prevent error if confirmations exceed the required count
            const progressBarLength = Math.max(0, requiredConfirmations - confirmations);
            const progressBar = '='.repeat(Math.min(confirmations, requiredConfirmations)) + '-'.repeat(progressBarLength);

            process.stdout.write(`\rConfirmations [${progressBar}] ${confirmations}/${requiredConfirmations}`);

            // If confirmations have reached or exceeded the required count
            if (confirmations >= requiredConfirmations) {
                process.stdout.write(`\nRequired confirmations (${requiredConfirmations}) reached or exceeded!\n`);
                return receipt;
            }

            await sleep(5000);
        } catch (error) {
            process.stdout.write(`\nError checking confirmations: ${error}\n`);
            await sleep(5000);
        }
    }
}

module.exports = { sleep, waitForConfirmations };
