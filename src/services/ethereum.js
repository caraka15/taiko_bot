const { ethers } = require('ethers');
const axios = require('axios');
const { logWithBorder } = require('../utils/logger');
const { chalk } = require('../utils/logger');
const { RPC_URL } = require('../constants');

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

async function getEthToUsdRate() {
    try {
        const response = await axios.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
        );
        return response.data.ethereum.usd;
    } catch (error) {
        logWithBorder(chalk.red(`✗ Failed to fetch ETH to USD rate: ${error.message}`));
        return null;
    }
}

module.exports = {
    provider,
    getEthToUsdRate,
    ethers
};