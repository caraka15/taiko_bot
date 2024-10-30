const { ethers, provider } = require('../services/ethereum');
const { sleep } = require('../utils/time');
const { chalk } = require('../utils/logger');
const { logWithBorder } = require('../utils/logger');
const { VOTE_ADDRESS, VOTE_ABI, REQUIRED_CONFIRMATIONS, MAX_RETRIES, RETRY_DELAY } = require('../constants');
const { fetchTaikoPoints } = require('../services/points');
const { getCurrentServerTime } = require('../utils/time');
const config = require('../../config/config.json');

const walletFees = new Map();
const walletPoints = new Map();

async function executeVoteTransaction(wallet, index) {
    try {
        const contract = new ethers.Contract(VOTE_ADDRESS, VOTE_ABI, wallet);
        console.log(chalk.yellow(`🗳️ Wallet-${index + 1} Executing vote...`));

        const tx = await contract.vote({
            maxFeePerGas: ethers.utils.parseUnits(config.vote.maxFee, "gwei"),
            maxPriorityFeePerGas: ethers.utils.parseUnits(config.vote.maxPriorityFee, "gwei"),
            gasLimit: 100000,
        });

        console.log(chalk.yellow(`🔄 Wallet-${index + 1} Vote Hash:`), chalk.blue(tx.hash));

        console.log(chalk.yellow(`⏳ Waiting for ${REQUIRED_CONFIRMATIONS} confirmation(s)...`));
        const receipt = await tx.wait(REQUIRED_CONFIRMATIONS);

        // Calculate and track fee
        const actualFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);
        const currentWalletFee = walletFees.get(index) || ethers.BigNumber.from(0);
        walletFees.set(index, currentWalletFee.add(actualFee));

        console.log(chalk.green(`✓ Vote confirmed for Wallet-${index + 1}`));
        return receipt;
    } catch (error) {
        console.error(chalk.red(`Error executing vote for Wallet-${index + 1}:`, error.message));
        throw error;
    }
}

async function processVoteWallets(walletConfigs, iteration) {
    logWithBorder(
        chalk.cyan(`📌 [${getCurrentServerTime()}] Starting Vote iteration ${iteration + 1}`)
    );

    // Initialize wallet info
    const walletInfos = await Promise.all(
        walletConfigs.map(async ({ privateKey, index }) => {
            const wallet = new ethers.Wallet(privateKey, provider);
            const points = await fetchTaikoPoints(wallet.address);
            const balance = await provider.getBalance(wallet.address);

            console.log(chalk.cyan(`\n🔷 Wallet-${index + 1} Status:`));
            if (points) {
                console.log(chalk.blue("📊 Initial Points:"), chalk.yellow(points.totalPoints.toFixed(2)));
                console.log(chalk.blue("🏆 Current Rank:"), chalk.yellow(points.rank));
            }
            console.log(chalk.blue("💎 Current balance:"), chalk.yellow(ethers.utils.formatEther(balance)), "ETH");

            return { wallet, points, balance, index };
        })
    );

    // Execute votes for all wallets in parallel
    const votePromises = walletInfos.map(async ({ wallet, index }) => {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                await executeVoteTransaction(wallet, index);
                break;
            } catch (error) {
                logWithBorder(chalk.red(`✗ Wallet-${index + 1} - Vote attempt ${attempt} failed: ${error.message}`));

                if (attempt === MAX_RETRIES) {
                    throw new Error(`Wallet-${index + 1} - Failed after ${MAX_RETRIES} attempts: ${error.message}`);
                }

                console.log(chalk.yellow(`⏳ Waiting ${RETRY_DELAY / 1000} seconds before retry...`));
                await sleep(RETRY_DELAY);
            }
        }
    });

    // Wait for all votes to complete
    await Promise.all(votePromises);

    // Wait for API update and fetch final points
    await sleep(5000);

    await Promise.all(
        walletInfos.map(async ({ wallet, points: initialPoints, index }) => {
            const finalPoints = await fetchTaikoPoints(wallet.address);
            if (finalPoints && initialPoints) {
                const pointsDifference = finalPoints.totalPoints - initialPoints.totalPoints;
                console.log(chalk.blue(`📊 Wallet-${index + 1} Points earned:`), chalk.green(`+${pointsDifference.toFixed(2)}`));
                console.log(
                    chalk.blue(`🏆 Wallet-${index + 1} New Rank:`),
                    chalk.yellow(finalPoints.rank),
                    finalPoints.rank < initialPoints.rank
                        ? chalk.green(`(↑${initialPoints.rank - finalPoints.rank})`)
                        : ""
                );

                if (!walletPoints.has(wallet.address)) {
                    walletPoints.set(wallet.address, []);
                }
                walletPoints.get(wallet.address).push({
                    iteration: iteration + 1,
                    pointsEarned: pointsDifference,
                    totalPoints: finalPoints.totalPoints,
                    rank: finalPoints.rank,
                    rankChange: initialPoints.rank - finalPoints.rank
                });
            }
        })
    );
}

module.exports = {
    processVoteWallets,
    walletFees,
    walletPoints
};