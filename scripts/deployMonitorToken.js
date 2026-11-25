// 部署 MonitorToken 到 Ethereum Sepolia，mint 给部署者。
const hre = require("hardhat");
const { save } = require("./deployments");
const guard = require("./guard");

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const Token = await hre.ethers.getContractFactory("MonitorToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const addr = await token.getAddress();
  console.log("MonitorToken:", addr, "deployer:", deployer.address);
  save({ MONITOR_TOKEN_ADDR: addr, MONITOR_TOKEN_DEPLOY_TX: token.deploymentTransaction()?.hash || "" });
  console.log("next: deployXfers (--network lasna), then triggerXfers");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
