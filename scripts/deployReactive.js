// Deploys SentinelReactive on Lasna. Requires lREACT on the deployer (see README faucets).
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load, save } = require("./deployments");
const guard = require("./guard");

// origin = destination = Ethereum Sepolia (11155111) by default; override with env
const ORIGIN_CHAIN = BigInt(process.env.ORIGIN_CHAIN || 11155111);
const DEST_CHAIN = BigInt(process.env.DEST_CHAIN || 11155111);
const SL = 95_000_000n;        // 0.95
const TP = 105_000_000n;       // 1.05

async function main() {
  await guard(hre);
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

  save({
    REACTIVE_ADDR: await reactive.getAddress(),
    REACTIVE_DEPLOY_TX: reactive.deploymentTransaction()?.hash || "",
  });
  console.log("next: deployVault, then bind");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
