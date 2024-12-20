// transaction.js
const { ethers, provider } = require('../services/ethereum');
const { sleep } = require('../utils/time');
const { chalk } = require('../utils/logger');
const { logWithBorder } = require('../utils/logger');
const { WETH_ADDRESS, WETH_ABI, REQUIRED_CONFIRMATIONS, MAX_RETRIES, RETRY_DELAY } = require('../constants');
const { fetchTaikoPoints } = require('../services/points');
const { getCurrentServerTime } = require('../utils/time');
const config = require('../../config/config.json');

const publicRpcList = require('../../config/publicRpc.json').checker_rpc;
const publicProviders = publicRpcList.map(url => new ethers.providers.JsonRpcProvider(url));

const walletFees = new Map();
const walletPoints = new Map();

let currentProviderIndex = 0;
let lastProviderChangeTime = Date.now();
const PROVIDER_SWITCH_INTERVAL = 30000; // 30 seconds

function getNextPublicProvider() {
    const currentTime = Date.now();
    if (currentTime - lastProviderChangeTime > PROVIDER_SWITCH_INTERVAL) {
        currentProviderIndex = (currentProviderIndex + 1) % publicProviders.length;
        lastProviderChangeTime = currentTime;
    }
    return publicProviders[currentProviderIndex];
}

async function retryGetReceipt(provider, txHash, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) return receipt;
        } catch (error) {
            console.log(chalk.yellow(`Receipt fetch attempt ${attempt} failed, retrying...`));
        }
        if (attempt < maxAttempts) await sleep(2000);
    }
    return null;
}

async function waitForAllConfirmations(transactions, requiredConfirmations) {
    const confirmationStates = new Map(
        transactions.map(({ hash, walletIndex }) => [hash, { confirmations: 0, walletIndex }])
    );

    process.stdout.write(chalk.yellow(`${"-".repeat(100)}\n⏳ Waiting for confirmations...\n`));

    const confirmedReceipts = [];

    while (confirmationStates.size > 0) {
        try {
            let statusLine = "";
            await Promise.all(
                Array.from(confirmationStates.entries()).map(async ([txHash, state]) => {
                    const publicProvider = getNextPublicProvider();
                    const receipt = await retryGetReceipt(publicProvider, txHash);

                    if (!receipt || !receipt.blockNumber) {
                        statusLine += chalk.yellow(`[Wallet-${state.walletIndex + 1}: Pending] `);
                        return;
                    }

                    try {
                        const currentBlock = await publicProvider.getBlockNumber();
                        const confirmations = Math.max(currentBlock - receipt.blockNumber + 1, 0);

                        if (confirmations >= requiredConfirmations) {
                            const mainReceipt = await retryGetReceipt(provider, txHash);
                            if (mainReceipt && mainReceipt.gasUsed && mainReceipt.effectiveGasPrice) {
                                confirmationStates.delete(txHash);
                                confirmedReceipts.push({ receipt: mainReceipt, walletIndex: state.walletIndex });
                            } else {
                                console.log(chalk.red(`⚠️ Invalid receipt data for transaction ${txHash}`));
                            }
                        } else {
                            statusLine += chalk.yellow(`[Wallet-${state.walletIndex + 1}: ${confirmations}/${requiredConfirmations} blocks] `);
                        }
                    } catch (blockError) {
                        console.log(chalk.red(`Error getting block info: ${blockError.message}`));
                    }
                })
            );

            process.stdout.write(`\r${" ".repeat(100)}\r${statusLine}`);

            if (confirmationStates.size > 0) {
                await sleep(5000);
            }
        } catch (error) {
            console.log(chalk.red(`Error in confirmation loop: ${error.message}`));
            await sleep(5000);
        }
    }

    console.log(chalk.green(`\n✓ All transactions confirmed!\n${"-".repeat(100)}`));
    return confirmedReceipts;
}

async function executeTransactions(operations, description) {
    const transactions = [];

    console.log(chalk.cyan(`📤 Executing ${description}...`));

    await Promise.all(
        operations.map(async ({ operation, walletIndex }) => {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const tx = await operation();
                    if (!tx || !tx.hash) {
                        throw new Error("Transaction failed - no hash returned");
                    }
                    console.log(chalk.yellow(`🔄 Wallet-${walletIndex + 1} ${description} Hash:`), chalk.blue(tx.hash));
                    transactions.push({ hash: tx.hash, walletIndex });
                    break;
                } catch (error) {
                    logWithBorder(chalk.red(`✗ Wallet-${walletIndex + 1} - Attempt ${attempt} failed: ${error.message}`));
                    if (attempt === MAX_RETRIES) {
                        throw new Error(`Failed after ${MAX_RETRIES} attempts`);
                    }
                    console.log(chalk.yellow(`⏳ Waiting ${RETRY_DELAY / 1000} seconds before retry...`));
                    await sleep(RETRY_DELAY);
                }
            }
        })
    );

    const confirmedReceipts = await waitForAllConfirmations(transactions, REQUIRED_CONFIRMATIONS);

    confirmedReceipts.forEach(({ receipt, walletIndex }) => {
        try {
            if (receipt && receipt.gasUsed && receipt.effectiveGasPrice) {
                const actualFee = receipt.gasUsed.mul(receipt.effectiveGasPrice);
                const currentWalletFee = walletFees.get(walletIndex) || ethers.BigNumber.from(0);
                walletFees.set(walletIndex, currentWalletFee.add(actualFee));
            } else {
                console.log(chalk.red(`⚠️ Invalid receipt for wallet ${walletIndex + 1}`));
            }
        } catch (error) {
            console.log(chalk.red(`Error calculating fees for wallet ${walletIndex + 1}: ${error.message}`));
        }
    });

    return confirmedReceipts;
}

async function processWallets(walletConfigs, iteration) {
    logWithBorder(
        chalk.cyan(`📌 [${getCurrentServerTime()}] Starting WETH iteration ${iteration + 1}`)
    );

    const walletInfos = await Promise.all(
        walletConfigs.map(async ({ privateKey, config: walletConfig }, index) => {
            try {
                const wallet = new ethers.Wallet(privateKey, provider);
                const points = await fetchTaikoPoints(wallet.address);
                const balance = await provider.getBalance(wallet.address);

                console.log(chalk.cyan(`\n🔷 Wallet-${index + 1} Status:`));
                if (points) {
                    console.log(chalk.blue("📊 Initial Points:"), chalk.yellow(points.totalPoints.toFixed(2)));
                    console.log(chalk.blue("🏆 Current Rank:"), chalk.yellow(points.rank));
                }
                console.log(chalk.blue("💎 Current balance:"), chalk.yellow(ethers.utils.formatEther(balance)), "ETH");
                console.log(chalk.blue("⚙️ Configured amount range:"),
                    chalk.yellow(`${walletConfig.amount_min} - ${walletConfig.amount_max}`), "ETH");

                return { wallet, points, balance, index, config: walletConfig };
            } catch (error) {
                console.log(chalk.red(`Error initializing wallet ${index + 1}: ${error.message}`));
                return null;
            }
        })
    );

    const validWalletInfos = walletInfos.filter(Boolean);

    const depositOperations = validWalletInfos.map(({ wallet, balance, index, config: walletConfig }) => {
        try {
            const contract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, wallet);
            const min = ethers.utils.parseEther(walletConfig.amount_min);
            const max = ethers.utils.parseEther(walletConfig.amount_max);
            const randomAmount = ethers.BigNumber.from(ethers.utils.randomBytes(32))
                .mod(max.sub(min))
                .add(min);

            console.log(
                chalk.blue(`🎲 Wallet-${index + 1} Random deposit amount:`),
                chalk.yellow(ethers.utils.formatEther(randomAmount)),
                "ETH"
            );

            if (balance.lt(randomAmount)) {
                console.log(chalk.red(`⚠️ Wallet-${index + 1}: Insufficient balance for deposit`));
                return null;
            }

            return {
                operation: () =>
                    contract.deposit({
                        value: randomAmount,
                        gasPrice: ethers.utils.parseUnits(config.weth.gasPrice, "gwei"),
                        gasLimit: 104817,
                    }),
                walletIndex: index,
            };
        } catch (error) {
            console.log(chalk.red(`Error creating deposit operation for wallet ${index + 1}: ${error.message}`));
            return null;
        }
    }).filter(Boolean);

    if (depositOperations.length > 0) {
        await executeTransactions(depositOperations, "Deposit");
    }

    await sleep(config.weth.interval * 1000);

    const withdrawOperations = await Promise.all(
        validWalletInfos.map(async ({ wallet, index }) => {
            try {
                const contract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, wallet);
                const wethBalance = await contract.balanceOf(wallet.address);

                console.log(
                    chalk.blue(`💎 Wallet-${index + 1} WETH balance:`),
                    chalk.yellow(ethers.utils.formatEther(wethBalance)),
                    "WETH"
                );

                if (wethBalance.isZero()) {
                    console.log(chalk.red(`⚠️ Wallet-${index + 1}: No WETH balance to withdraw`));
                    return null;
                }

                return {
                    operation: () =>
                        contract.withdraw(wethBalance, {
                            gasPrice: ethers.utils.parseUnits(config.weth.gasPrice, "gwei"),
                            gasLimit: 100000,
                        }),
                    walletIndex: index,
                };
            } catch (error) {
                console.log(chalk.red(`Error creating withdraw operation for wallet ${index + 1}: ${error.message}`));
                return null;
            }
        })
    );

    const validWithdrawOperations = withdrawOperations.filter(Boolean);
    if (validWithdrawOperations.length > 0) {
        await executeTransactions(validWithdrawOperations, "Withdraw");
    }

    await sleep(5000);

    await Promise.all(
        validWalletInfos.map(async ({ wallet, points: initialPoints, index }) => {
            try {
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
            } catch (error) {
                console.log(chalk.red(`Error updating points for wallet ${index + 1}: ${error.message}`));
            }
        })
    );

    if (iteration < config.weth.iterations - 1) {
        logWithBorder(
            chalk.yellow(`⏳ Waiting ${config.weth.interval} seconds before next iteration...`),
            "-"
        );
        await sleep(config.weth.interval * 1000);
    }
}

module.exports = {
    processWallets,
    walletFees,
    walletPoints
};