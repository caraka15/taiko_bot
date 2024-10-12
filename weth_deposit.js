require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");

// Konfigurasi
const provider = new ethers.providers.JsonRpcProvider(
  "https://rpc.taiko.tools/"
);

// Private key dari wallet Anda
const privateKey = process.env.PRIVATE_KEY;

// Menghubungkan wallet
const wallet = new ethers.Wallet(privateKey, provider);

// ABI
const contractABI = JSON.parse(fs.readFileSync("abi.json", "utf8"));

const contractAddress = "0xA51894664A773981C6C112C43ce576f315d5b1B6";

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// Fungsi
async function deposit() {
  const amount = ethers.utils.parseEther("0.0004"); // Jumlah deposit

  try {
    const tx = await contract.deposit({
      value: amount,
      gasPrice: ethers.utils.parseUnits("0.09", "gwei"),
      gasLimit: 104817,
    });

    console.log("Transaction Hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction was mined in block:", receipt.blockNumber);
  } catch (error) {
    console.error("Transaction failed:", error);
  }
}

// Memanggil fungsi deposit
deposit().catch(console.error);
