// 部署 Xfers 到 Lasna，构造函数订阅 Sepolia ERC-20 Transfer，充值 0.2 lREACT。
const hre = require("hardhat");
const { save } = require("./deployments");
const guard = require("./guard");

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log("deployer lREACT balance:", hre.ethers.formatEther(bal));
  const Xfers = await hre.ethers.getContractFactory("Xfers");
  const xfers = await Xfers.deploy(5, { value: hre.ethers.parseEther("0.2") });
  await xfers.waitForDeployment();
  const addr = await xfers.getAddress();
  console.log("Xfers:", addr);
  save({ XFERS_ADDR: addr, XFERS_DEPLOY_TX: xfers.deploymentTransaction()?.hash || "" });
  console.log("next: triggerXfers");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
