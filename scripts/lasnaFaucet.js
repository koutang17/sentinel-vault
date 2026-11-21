// Funds the Lasna faucet: sends testnet ETH from the test wallet to the faucet
// contract on Ethereum Sepolia (1 ETH -> 100 lREACT). Testnet only: refuses
// to run unless chainId == 11155111 (Ethereum Sepolia).
const { ethers } = require("hardhat");
require("dotenv").config();

const FAUCET = "0x9b9BB25f1A81078C544C829c5EB7822d747Cf434"; // Lasna faucet, Ethereum Sepolia
const AMOUNT = ethers.parseEther("0.9"); // cap is 5 ETH; 0.9 -> ~90 lREACT

async function main() {
  if (!process.env.SEPOLIA_RPC) throw new Error("SEPOLIA_RPC missing in .env");
  if (!process.env.DEST_PK) throw new Error("DEST_PK missing in .env");
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
  const { chainId } = await provider.getNetwork();
  if (chainId !== 11155111n) {
    throw new Error("refusing: expected Ethereum Sepolia (11155111), got " + chainId);
  }
  const wallet = new ethers.Wallet(process.env.DEST_PK, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log("wallet:", wallet.address);
  console.log("balance:", ethers.formatEther(bal), "ETH");
  if (bal < AMOUNT + 100000000000000n) throw new Error("not enough Sepolia ETH - claim from the faucet first");
  const tx = await wallet.sendTransaction({ to: FAUCET, value: AMOUNT });
  console.log("faucet tx:", tx.hash);
  await tx.wait();
  console.log("sent", ethers.formatEther(AMOUNT), "ETH -> expect ~90 lREACT on the same address (Lasna)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
