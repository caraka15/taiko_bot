const axios = require('axios');
const { logWithBorder } = require('../utils/logger');
const { chalk } = require('../utils/logger');
const { ethers } = require('./ethereum');
const { getCurrentServerTime } = require('../utils/time');
const { getWalletConfigs } = require('../utils/wallet');

async function sendTelegramNotification(message) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Content-Type": "application/json",
    };

    try {
        await axios.post(
            url,
            {
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
            },
            { headers }
        );
        logWithBorder(chalk.green("✓ Telegram notification sent successfully"));
    } catch (error) {
        logWithBorder(chalk.red(`✗ Failed to send Telegram notification: ${error.message}`));
    }
}

async function generateFinalReport(walletPoints, walletFees, completedIterations, mode) {
    try {
        const ethToUsdRate = await require('./ethereum').getEthToUsdRate();
        const operationType = mode === 'weth' ? 'WETH Deposit/Withdraw' : 'Vote';
        let feesReport = `\n\n<b>💰 ${operationType} Fee Summary per Wallet:</b>`;
        let totalFeesEth = ethers.BigNumber.from(0);
        let totalFeesUsd = 0;

        if (walletFees.size > 0) {
            for (const [walletIndex, feeWei] of walletFees.entries()) {
                const feeEth = Number(ethers.utils.formatEther(feeWei)).toFixed(8);
                const feeUsd = ethToUsdRate ? (parseFloat(feeEth) * ethToUsdRate).toFixed(2) : null;

                if (feeUsd) {
                    totalFeesUsd += parseFloat(feeUsd);
                }
                totalFeesEth = totalFeesEth.add(feeWei);

                feesReport += `\n• Wallet-${walletIndex + 1}: ${feeEth} ETH${feeUsd ? ` ($${feeUsd})` : ''}`;
            }

            const totalFeesEthFormatted = ethers.utils.formatEther(totalFeesEth);
            feesReport += `\n\n<b>Total Fees:</b> ${Number(totalFeesEthFormatted).toFixed(8)} ETH${totalFeesUsd ? ` ($${totalFeesUsd.toFixed(2)})` : ''}`;
            feesReport += `\n<b>Average Fee per Wallet:</b> ${(Number(totalFeesEthFormatted) / walletFees.size).toFixed(8)} ETH${totalFeesUsd ? ` ($${(totalFeesUsd / walletFees.size).toFixed(2)})` : ''}`;
        } else {
            feesReport += "\n• No fees recorded";
        }

        let pointsReport = '';
        let totalPointsEarnedAll = 0;
        if (walletPoints.size > 0) {
            pointsReport = '\n\n<b>🎯 Points Summary per Wallet:</b>';
            for (const [address, points] of walletPoints.entries()) {
                if (points && points.length > 0) {
                    const totalPointsEarned = points.reduce((sum, p) => sum + p.pointsEarned, 0);
                    totalPointsEarnedAll += totalPointsEarned;
                    const latestPoints = points[points.length - 1];
                    const initialPoints = points[0];
                    const rankChange = initialPoints.rank - latestPoints.rank;

                    pointsReport += `\n\n<code>${address.substring(0, 6)}...${address.slice(-4)}</code>:
• Total Points Earned: ${totalPointsEarned.toFixed(2)}
• Final Total Points: ${latestPoints.totalPoints.toFixed(2)}
• Rank Change: ${rankChange > 0 ? `↑${rankChange}` : rankChange < 0 ? `↓${Math.abs(rankChange)}` : "No change"}
• Current Rank: ${latestPoints.rank}`;
                }
            }

            const totalTx = completedIterations * getWalletConfigs().length;
            pointsReport += `\n\n<b>Total Points Earned (All Wallets):</b> ${totalPointsEarnedAll.toFixed(2)}`;
            pointsReport += `\n<b>Average Points per Wallet:</b> ${(totalPointsEarnedAll / walletPoints.size).toFixed(2)}`;
            if (totalTx > 0) {
                pointsReport += `\n<b>Average Points per TX:</b> ${(totalPointsEarnedAll / totalTx).toFixed(2)}`;
            }
        } else {
            pointsReport = '\n\n<b>🎯 Points Summary:</b>\n• No points recorded';
        }

        const notificationMessage = `
<b>🎉 ${operationType} Task Completed</b>

Halo! Saya senang memberitahu Anda bahwa tugas ${operationType} telah selesai dilaksanakan.

<b>📊 Ringkasan:</b>
• Mode: ${operationType}
• Total Iterasi Berhasil: ${completedIterations || 0}
• Jumlah Wallet: ${getWalletConfigs().length}
• Waktu Selesai: ${getCurrentServerTime(true)}
${feesReport}
${pointsReport}

Semua operasi telah selesai dilakukan sesuai dengan konfigurasi yang ditetapkan.

Terima kasih atas perhatian Anda. Jika ada pertanyaan atau masalah, jangan ragu untuk menghubungi tim dukungan @caraka17.

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>`;

        return notificationMessage;
    } catch (error) {
        console.error('Error generating report:', error);
        return `
<b>⚠️ Error Report</b>

An error occurred while generating the final report: ${error.message}

• Mode: ${mode.toUpperCase()}
• Total Iterasi Berhasil: ${completedIterations || 0}
• Waktu: ${getCurrentServerTime(true)}

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>`;
    }
}

module.exports = {
    sendTelegramNotification,
    generateFinalReport
};