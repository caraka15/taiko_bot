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


async function generateFinalReport(walletPoints, walletFees, completedIterations) {
    try {
        const ethToUsdRate = await require('./ethereum').getEthToUsdRate();
        let feesReport = '\n\n<b>💰 Fee Summary per Wallet:</b>';
        let totalFeesUsd = 0;

        // Generate per-wallet fee report
        if (walletFees.size > 0) {
            for (const [walletIndex, feeWei] of walletFees.entries()) {
                const feeEth = Number(ethers.utils.formatEther(feeWei)).toFixed(8);
                const feeUsd = ethToUsdRate ? (parseFloat(feeEth) * ethToUsdRate).toFixed(2) : null;

                if (feeUsd) {
                    totalFeesUsd += parseFloat(feeUsd);
                }

                feesReport += `\n• Wallet-${walletIndex + 1}: ${feeEth} ETH${feeUsd ? ` ($${feeUsd})` : ''}`;
            }
        } else {
            feesReport += "\n• No fees recorded";
        }

        // Generate points report
        let pointsReport = '';
        if (walletPoints.size > 0) {
            pointsReport = '\n\n<b>🎯 Points Summary per Wallet:</b>';
            for (const [address, points] of walletPoints.entries()) {
                if (points && points.length > 0) {
                    const totalPointsEarned = points.reduce((sum, p) => sum + p.pointsEarned, 0);
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
        } else {
            pointsReport = '\n\n<b>🎯 Points Summary:</b>\n• No points recorded';
        }

        const notificationMessage = `
<b>🎉 Tugas Otomatis Selesai</b>

Halo! Saya senang memberitahu Anda bahwa tugas otomatis telah selesai dilaksanakan.

<b>📊 Ringkasan:</b>
• Total Iterasi Berhasil: ${completedIterations || 0}
• Jumlah Wallet: ${getWalletConfigs().length}
• Waktu Selesai: ${getCurrentServerTime(true)} // Menggunakan parameter true untuk mendapatkan waktu tanpa warna
${feesReport}
${pointsReport}

Semua operasi deposit dan penarikan telah selesai dilakukan sesuai dengan konfigurasi yang ditetapkan.

Terima kasih atas perhatian Anda. Jika ada pertanyaan atau masalah, jangan ragu untuk menghubungi tim dukungan @caraka17.

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>`;

        return notificationMessage;
    } catch (error) {
        console.error('Error generating report:', error);
        return `
<b>⚠️ Error Report</b>

An error occurred while generating the final report: ${error.message}

• Total Iterasi Berhasil: ${completedIterations || 0}
• Waktu: ${getCurrentServerTime(true)}

<i>Pesan ini dikirim secara otomatis oleh sistem.</i>`;
    }
}

module.exports = {
    sendTelegramNotification,
    generateFinalReport
};