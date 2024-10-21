// weth_withdraw.js
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Configuration
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

// Constants
const REQUIRED_CONFIRMATIONS = config.confirmation.required;
const MAX_RETRIES = config.confirmation.maxRetries;
const RETRY_DELAY = config.confirmation.retryDelay;

// Private key from your wallet
const privateKey = process.env.PRIVATE_KEY;

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Connect wallet
const wallet = new ethers.Wallet(privateKey, provider);

// ABI
const contractABI = JSON.parse(fs.readFileSync("abi.json", "utf8"));

// Smart contract address
const contractAddress =
  process.env.CONTRACT_ADDRESS || "0xA51894664A773981C6C112C43ce576f315d5b1B6";

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForConfirmations(txHash, requiredConfirmations) {
  process.stdout.write(`\nWait ${requiredConfirmations} confirmations`);

  while (true) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);

      if (!receipt) {
        process.stdout.write(`\rTransaction pending...`);
        await sleep(5000);
        continue;
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      // Create progress bar
      const progressBar = '='.repeat(confirmations) + '-'.repeat(requiredConfirmations - confirmations);
      process.stdout.write(`\rConfirmations [${progressBar}] ${confirmations}/${requiredConfirmations}`);

      if (confirmations >= requiredConfirmations) {
        process.stdout.write(`\nRequired confirmations (${requiredConfirmations}) reached!\n`);
        return receipt;
      }

      await sleep(5000);
    } catch (error) {
      process.stdout.write(`\nError checking confirmations: ${error}\n`);
      await sleep(5000);
    }
  }
}

async function executeWithdraw() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Withdraw attempt ${attempt} of ${MAX_RETRIES}`);

      // Check WETH balance
      const wethBalance = await contract.balanceOf(wallet.address);
      console.log("Current WETH balance:", ethers.utils.formatEther(wethBalance), "WETH");

      // If no WETH balance, exit the function
      if (wethBalance.isZero()) {
        throw new Error("No WETH balance to withdraw");
      }

      // Use the entire WETH balance as the withdrawal amount
      const withdrawAmount = wethBalance;
      console.log("Withdrawing full balance:", ethers.utils.formatEther(withdrawAmount), "WETH");

      const tx = await contract.withdraw(withdrawAmount, {
        gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
        gasLimit: 100000,
      });

      console.log("Transaction Hash:", tx.hash);

      // Wait for confirmations
      const receipt = await waitForConfirmations(tx.hash);
      console.log("Transaction was mined in block:", receipt.blockNumber);

      // Calculate and log the transaction fee
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.effectiveGasPrice;
      const fee = gasUsed.mul(gasPrice);
      console.log("Transaction fee:", ethers.utils.formatEther(fee), "ETH");

      // Transaction successful, return from function
      return;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (attempt === MAX_RETRIES) {
        throw new Error(`Withdraw failed after ${MAX_RETRIES} attempts: ${error.message}`);
      }

      console.log(`Waiting ${RETRY_DELAY / 1000} seconds before retry...`);
      await sleep(RETRY_DELAY);
    }
  }
}

// Execute withdraw with retries
executeWithdraw().catch(error => {
  console.error("Final error:", error);
  process.exit(1);
});