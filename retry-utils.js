// retry-utils.js
const { ethers } = require("ethers");

async function waitForConfirmations(
    provider,
    txHash,
    requiredConfirmations = 9
) {
    console.log(`Waiting for ${requiredConfirmations} confirmations...`);

    while (true) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);

            if (!receipt) {
                console.log("Transaction not yet mined, waiting...");
                await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds
                continue;
            }

            const currentBlock = await provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber + 1;

            console.log(`Current confirmations: ${confirmations}`);

            if (confirmations >= requiredConfirmations) {
                console.log(`Transaction confirmed with ${confirmations} blocks`);
                return { success: true, receipt };
            }

            console.log(
                `Waiting for more confirmations... (${confirmations}/${requiredConfirmations})`
            );
            await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds
        } catch (error) {
            console.error("Error checking confirmations:", error.message);
            await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds
        }
    }
}

async function retryTransaction(operation, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt} of ${maxRetries}`);
            const tx = await operation();
            console.log(`Transaction hash: ${tx.hash}`);

            // Wait for confirmations
            const { success, receipt } = await waitForConfirmations(
                tx.provider,
                tx.hash
            );

            if (success) {
                const gasUsed = receipt.gasUsed;
                const gasPrice = receipt.effectiveGasPrice;
                const fee = gasUsed.mul(gasPrice);
                console.log("Transaction confirmed successfully!");
                console.log("Block number:", receipt.blockNumber);
                console.log("Transaction fee:", ethers.utils.formatEther(fee), "ETH");
                return { success: true, receipt, fee };
            }
        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error.message);
            if (attempt === maxRetries) {
                throw new Error(
                    `Failed after ${maxRetries} attempts: ${error.message}`
                );
            }
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 15000));
        }
    }
    return { success: false };
}

module.exports = { retryTransaction, waitForConfirmations };
