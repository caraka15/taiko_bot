const config = require('../config/config.json');

module.exports = {
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0xA51894664A773981C6C112C43ce576f315d5b1B6",
    RPC_URL: process.env.RPC_URL || "https://rpc.taiko.tools/",
    REQUIRED_CONFIRMATIONS: config.confirmation.required,
    MAX_RETRIES: config.confirmation.maxRetries,
    RETRY_DELAY: config.confirmation.retryDelay,
};