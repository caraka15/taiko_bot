// weth_deposit.js
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const { sleep, waitForConfirmations } = require("./utils");

// Configuration
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

// Constants
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const REQUIRED_CONFIRMATIONS = config.confirmation.required;
const MAX_RETRIES = config.confirmation.maxRetries;
const RETRY_DELAY = config.confirmation.retryDelay;

// Private key from your wallet
const privateKey = process.env.PRIVATE_KEY;

// Connect wallet
const wallet = new ethers.Wallet(privateKey, provider);

// ABI
const contractABI = JSON.parse(fs.readFileSync("abi.json", "utf8"));

const contractAddress =
  process.env.CONTRACT_ADDRESS || "0xA51894664A773981C6C112C43ce576f315d5b1B6";

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Function to get random deposit amount
function getRandomDepositAmount() {
  const min = ethers.utils.parseEther(config.amount_min);
  const max = ethers.utils.parseEther(config.amount_max);
  const randomBigNumber = ethers.BigNumber.from(ethers.utils.randomBytes(32))
    .mod(max.sub(min))
    .add(min);
  return randomBigNumber;
}

// Execute deposit with retries
async function executeDeposit() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Deposit attempt ${attempt} of ${MAX_RETRIES}`);

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      console.log("Current balance:", ethers.utils.formatEther(balance), "ETH");

      // Calculate random deposit amount
      const randomAmount = getRandomDepositAmount();
      console.log("Random deposit amount:", ethers.utils.formatEther(randomAmount), "ETH");

      // Ensure balance is sufficient for deposit
      if (balance.lt(randomAmount)) {
        throw new Error("Insufficient balance for deposit");
      }

      const tx = await contract.deposit({
        value: randomAmount,
        gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
        gasLimit: 104817,
      });

      console.log("Transaction Hash:", tx.hash);

      // Wait for confirmations with the required number of confirmations
      const receipt = await waitForConfirmations(provider, tx.hash, REQUIRED_CONFIRMATIONS);
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
        throw new Error(`Deposit failed after ${MAX_RETRIES} attempts: ${error.message}`);
      }

      console.log(`Waiting ${RETRY_DELAY / 1000} seconds before retry...`);
      await sleep(RETRY_DELAY);
    }
  }
}

executeDeposit().catch(error => {
  console.error("Final error:", error);
  process.exit(1);
});
