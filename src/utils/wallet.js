const config = require('../../config/config.json');

function getWalletConfigs() {
    const mode = process.env.MODE || 'weth';
    const modeConfig = mode === 'weth' ? config.weth : config.vote;

    const privateKeys = Object.keys(process.env)
        .filter((key) => key.startsWith("PRIVATE_KEY_"))
        .sort()
        .map((key) => {
            const walletNum = key.split('_')[2];

            // Base configuration for both modes
            const baseConfig = {
                privateKey: process.env[key],
                index: parseInt(walletNum) - 1
            };

            // Add additional config for WETH mode only
            if (mode === 'weth') {
                const walletKey = `wallet${walletNum}`;
                return {
                    ...baseConfig,
                    config: modeConfig.wallets?.[walletKey] || {
                        amount_min: modeConfig.amount_min || "0.001",
                        amount_max: modeConfig.amount_max || "0.003"
                    }
                };
            }

            return baseConfig;
        });

    return privateKeys;
}

module.exports = {
    getWalletConfigs
};