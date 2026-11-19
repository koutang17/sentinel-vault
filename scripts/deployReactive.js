// Deploys SentinelReactive on Lasna. Requires lREACT on the deployer (see README faucets).
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load, save } = require("./deployments");

const ORIGIN_CHAIN = 84532n;   // Base Sepolia
const DEST_CHAIN = 84532n;     // Base Sepolia
const SL = 95_000_000n;        // 0.95
const TP = 105_000_000n;       // 1.05

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { ORACLE_ADDR } = load();
  if (!ORACLE_ADDR) throw new Error("run deployOracle first");

  const topic0 = ethers.id("PriceUpdated(uint256,uint256)");
  const Reactive = await hre.ethers.getContractFactory("SentinelReactive");
  const reactive = await Reactive.deploy(ORIGIN_CHAIN, ORACLE_ADDR, topic0, DEST_CHAIN, SL, TP, {
    value: ethers.parseEther("0.1"),
  });
  await reactive.waitForDeployment();
  console.log("reactive:", await reactive.getAddress());

  save({ REACTIVE_ADDR: await reactive.getAddress() });
  console.log("next: deployVault, then bind");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
