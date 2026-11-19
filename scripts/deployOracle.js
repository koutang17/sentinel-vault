// Deploys the mock oracle and the test asset on the destination chain (Base Sepolia).
const hre = require("hardhat");
const { save } = require("./deployments");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("deployer:", deployer.address);

  const Oracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(100_000_000n); // $1.00, 8 decimals
  await oracle.waitForDeployment();
  console.log("oracle:", await oracle.getAddress());

  const Token = await hre.ethers.getContractFactory("MockToken");
  const token = await Token.deploy("Sentinel USD", "sUSD");
  await token.waitForDeployment();
  console.log("asset:", await token.getAddress());

  save({ ORACLE_ADDR: await oracle.getAddress(), ASSET_ADDR: await token.getAddress() });
  console.log("saved to deployments.local.json");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
