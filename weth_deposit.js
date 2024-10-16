require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Configuration
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

// Private key from your wallet
const privateKey = process.env.PRIVATE_KEY;

// Connect wallet
const wallet = new ethers.Wallet(privateKey, provider);

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

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

// Function
async function deposit() {
  try {
    console.log(`Processing deposit for wallet: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Current balance:", ethers.utils.formatEther(balance), "ETH");

    // Calculate random deposit amount
    const randomAmount = getRandomDepositAmount();
    console.log(
      "Random deposit amount:",
      ethers.utils.formatEther(randomAmount),
      "ETH"
    );

    // Ensure balance is sufficient for deposit
    if (balance.lt(randomAmount)) {
      console.log("Insufficient balance for deposit");
      return;
    }

    const tx = await contract.deposit({
      value: randomAmount,
      gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
      gasLimit: 104817,
    });

    console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction was mined in block:", receipt.blockNumber);

    // Calculate and log the transaction fee
    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.effectiveGasPrice;
    const fee = gasUsed.mul(gasPrice);
    console.log("Transaction fee:", ethers.utils.formatEther(fee), "ETH");
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

// Call deposit function
deposit().catch(console.error);
