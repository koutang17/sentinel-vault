// 部署 DynamicSub 到 Lasna，构造时不订阅；充值 0.3 lREACT。
const hre = require("hardhat");
const { save, load } = require("./deployments");
const guard = require("./guard");

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const { MONITOR_TOKEN_ADDR } = load();
  if (!MONITOR_TOKEN_ADDR) throw new Error("deploy MonitorToken first (scripts/deployMonitorToken.js --network eth-sepolia)");
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("deployer lREACT:", hre.ethers.formatEther(bal), "token:", MONITOR_TOKEN_ADDR);
  const F = await hre.ethers.getContractFactory("DynamicSub");
  const c = await F.deploy(MONITOR_TOKEN_ADDR, 3, { value: hre.ethers.parseEther("0.3") });
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("DynamicSub:", addr);
  save({ DYNAMIC_SUB_ADDR: addr, DYNAMIC_SUB_DEPLOY_TX: c.deploymentTransaction()?.hash || "" });
  console.log("next: runDynamicSub.js --network eth-sepolia");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
