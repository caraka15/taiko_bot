const config = require('../../config/config.json');

function getWalletConfigs() {
    const privateKeys = Object.keys(process.env)
        .filter((key) => key.startsWith("PRIVATE_KEY_"))
        .sort()
        .map((key) => {
            const walletNum = key.split('_')[2];
            const walletKey = `wallet${walletNum}`;
            const walletConfig = config.wallets?.[walletKey] || {
                amount_min: config.amount_min || "0.001",
                amount_max: config.amount_max || "0.003"
            };

            return {
                privateKey: process.env[key],
                config: walletConfig
            };
        });

    return privateKeys;
}

module.exports = {
    getWalletConfigs
};