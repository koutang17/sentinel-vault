// Deploys SentinelVault on Base Sepolia. Funded with native ETH to pay callback fees.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load, save } = require("./deployments");
const guard = require("./guard");

// Callback proxy per destination chain (dev.reactive.network/origins-and-destinations)
const PROXIES = {
  84532: "0x476F44b11F5C942c58f4c8E3d0300E5710743585",     // Base Sepolia
  11155111: "0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4", // Ethereum Sepolia
};

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const { ORACLE_ADDR, ASSET_ADDR, REACTIVE_ADDR } = load();
  if (!ORACLE_ADDR || !ASSET_ADDR) throw new Error("run deployOracle first");
  if (!REACTIVE_ADDR) throw new Error("run deployReactive first");

  const { chainId } = await hre.ethers.provider.getNetwork();
  const CALLBACK_PROXY = PROXIES[Number(chainId)];
  if (!CALLBACK_PROXY) throw new Error("no callback proxy configured for chain " + chainId);
  const Vault = await hre.ethers.getContractFactory("SentinelVault");
  const vault = await Vault.deploy(CALLBACK_PROXY, REACTIVE_ADDR, ORACLE_ADDR, ASSET_ADDR, {
    value: ethers.parseEther("0.02"),
  });
  await vault.waitForDeployment();
  console.log("vault:", await vault.getAddress());

  save({
    VAULT_ADDR: await vault.getAddress(),
    VAULT_DEPLOY_TX: vault.deploymentTransaction()?.hash || "",
  });
  console.log("next: bind (reactive.setVault) then demo");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
