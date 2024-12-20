const axios = require('axios');
const { sleep } = require('../utils/time');
const { chalk } = require('../utils/logger');

async function fetchTaikoPoints(address) {
    try {
        const headers = {
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Origin': 'https://trailblazer.mainnet.taiko.xyz',
            'Referer': 'https://trailblazer.mainnet.taiko.xyz/',
            'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        };

        const response = await axios.get(
            `https://trailblazer.mainnet.taiko.xyz/s3/user/rank?address=${address}`,
            {
                headers,
                timeout: 10000
            }
        );

        if (!response.data || !response.data.breakdown) {
            throw new Error('Invalid API response format');
        }

        const breakdown = response.data.breakdown;
        // Total points now comes directly from the API as totalScore
        const totalPoints = response.data.totalScore || response.data.score || 0;

        return {
            transactionPoints: breakdown.find(b => b.event === "Transaction")?.total_points || 0,
            valuePoints: breakdown.find(b => b.event === "TransactionValue")?.total_points || 0,
            totalPoints,
            rank: response.data.rank,
            total: response.data.total,
            multiplier: response.data.multiplier
        };
    } catch (error) {
        if (error.response) {
            console.error(chalk.red(`API Error (${error.response.status}): ${error.response.statusText}`));
            console.error(chalk.red(`Error details: ${JSON.stringify(error.response.data)}`));
        } else if (error.request) {
            console.error(chalk.red(`Network Error: No response received - ${error.message}`));
        } else {
            console.error(chalk.red(`Failed to fetch points for ${address}: ${error.message}`));
        }
        await sleep(2000);
        return null;
    }
}

module.exports = {
    fetchTaikoPoints
};