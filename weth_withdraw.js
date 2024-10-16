require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Configuration
const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://rpc.taiko.tools/"
);

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

async function withdraw() {
  try {
    console.log(`Processing withdrawal for wallet: ${wallet.address}`);

    // Check WETH balance
    const wethBalance = await contract.balanceOf(wallet.address);
    console.log(
      "Current WETH balance:",
      ethers.utils.formatEther(wethBalance),
      "WETH"
    );

    // If no WETH balance, exit the function
    if (wethBalance.isZero()) {
      console.log("No WETH balance to withdraw");
      return;
    }

    // Use the entire WETH balance as the withdrawal amount
    const withdrawAmount = wethBalance;
    console.log(
      "Withdrawing full balance:",
      ethers.utils.formatEther(withdrawAmount),
      "WETH"
    );

    const tx = await contract.withdraw(withdrawAmount, {
      gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
      gasLimit: 100000,
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

// Call withdraw function
withdraw().catch(console.error);
