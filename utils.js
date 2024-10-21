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
async function waitForConfirmations(txHash, requiredConfirmations) {
    process.stdout.write(`\nWaiting for at least ${requiredConfirmations} confirmations`);

    while (true) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);

            // Jika transaksi belum dimining
            if (!receipt || !receipt.blockNumber) {
                process.stdout.write(`\rTransaction pending...`);
                await sleep(5000);
                continue;
            }

            const currentBlock = await provider.getBlockNumber();
            const confirmations = Math.max(currentBlock - receipt.blockNumber + 1, 0);

            // Cek apakah jumlah konfirmasi valid
            if (confirmations < 0) {
                console.error(`\nError: Invalid confirmation count (${confirmations}). Retrying...`);
                await sleep(5000);
                continue;
            }

            // Tampilkan jumlah konfirmasi sederhana
            process.stdout.write(`\rConfirmations ${confirmations}/${requiredConfirmations}`);

            // Jika jumlah konfirmasi sudah mencapai atau melebihi yang dibutuhkan
            if (confirmations >= requiredConfirmations) {
                process.stdout.write(`\nRequired confirmations (${requiredConfirmations}) reached!\n`);
                return receipt; // Lanjutkan operasi setelah konfirmasi tercapai
            }

            await sleep(5000); // Tunggu sebelum mencoba lagi
        } catch (error) {
            console.error(`\nError checking confirmations: ${error}`);
            await sleep(5000); // Tunggu sebelum mencoba lagi jika terjadi error
        }
    }
}



module.exports = { sleep, waitForConfirmations };
