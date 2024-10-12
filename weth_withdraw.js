require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Konfigurasi
const provider = new ethers.providers.JsonRpcProvider(
  "https://rpc.taiko.tools/"
);

// Private key dari wallet Anda
const privateKey = process.env.PRIVATE_KEY;

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Menghubungkan wallet
const wallet = new ethers.Wallet(privateKey, provider);

// ABI
const contractABI = JSON.parse(fs.readFileSync("abi.json", "utf8"));

// Alamat smart contract
const contractAddress = "0xA51894664A773981C6C112C43ce576f315d5b1B6";

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

async function withdraw() {
  const amount = ethers.utils.parseEther(config.amount); // Jumlah withdraw

  try {
    const tx = await contract.withdraw(amount, {
      gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei"),
      gasLimit: 100000,
    });

    console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction was mined in block:", receipt.blockNumber);
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

// Memanggil fungsi withdraw
withdraw().catch(console.error);
