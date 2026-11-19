// Deploys SentinelVault on Base Sepolia. Funded with native ETH to pay callback fees.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load, save } = require("./deployments");

// Base Sepolia callback proxy (dev.reactive.network/origins-and-destinations)
const CALLBACK_PROXY = "0x476F44b11F5C942c58f4c8E3d0300E5710743585";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { ORACLE_ADDR, ASSET_ADDR, REACTIVE_ADDR } = load();
  if (!ORACLE_ADDR || !ASSET_ADDR) throw new Error("run deployOracle first");
  if (!REACTIVE_ADDR) throw new Error("run deployReactive first");

  const Vault = await hre.ethers.getContractFactory("SentinelVault");
  const vault = await Vault.deploy(CALLBACK_PROXY, REACTIVE_ADDR, ORACLE_ADDR, ASSET_ADDR, {
    value: ethers.parseEther("0.02"),
  });
  await vault.waitForDeployment();
  console.log("vault:", await vault.getAddress());

  save({ VAULT_ADDR: await vault.getAddress() });
  console.log("next: bind (reactive.setVault) then demo");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
