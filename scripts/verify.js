
const hre = require("hardhat");
const { ethers } = hre;
const d = require("../deployments.local.json");
(async () => {
  const Vault = await ethers.getContractFactory("SentinelVault");
  const vault = Vault.attach(d.VAULT_ADDR);
  const Token = await ethers.getContractFactory("MockToken");
  const token = Token.attach(d.ASSET_ADDR);
  const owner = await vault.owner();
  console.log("vault.closed():", await vault.closed());
  console.log("vault.armed():", await vault.armed());
  console.log("owner:", owner);
  console.log("vault token balance:", (await token.balanceOf(d.VAULT_ADDR)).toString());
  console.log("owner token balance:", (await token.balanceOf(owner)).toString());
  const latest = await ethers.provider.getBlockNumber();
  const evs = await vault.queryFilter("VaultClosed", Math.max(0, latest - 9), latest);
  console.log("VaultClosed events in last 10 blocks:", evs.length);
  for (const e of evs) {
    console.log(JSON.stringify({
      tx: e.transactionHash,
      block: e.blockNumber,
      owner: e.args.owner,
      exitPrice: e.args.exitPrice.toString(),
      reportedPrice: e.args.reportedPrice.toString(),
      reason: e.args.reason,
    }, null, 2));
  }
})().catch(e => { console.error("ERR", e.message); process.exitCode = 1; });
