
const hre = require("hardhat");
const { ethers } = hre;
const d = require("../deployments.local.json");
(async () => {
  const lasna = new ethers.JsonRpcProvider("https://lasna-rpc.rnk.dev/");
  const topic = ethers.id("Triggered(uint256,string)");
  const latest = await lasna.getBlockNumber();
  const logs = await lasna.getLogs({ address: d.REACTIVE_ADDR, fromBlock: Math.max(0, latest - 400), toBlock: latest, topics: [topic] });
  console.log("lasna Triggered logs:", logs.length);
  for (const l of logs) {
    const [price, reason] = new ethers.AbiCoder().decode(["uint256", "string"], l.data);
    console.log(JSON.stringify({ tx: l.transactionHash, block: l.blockNumber, price: price.toString(), reason }));
  }
  const Vault = await ethers.getContractFactory("SentinelVault");
  const vault = Vault.attach(d.VAULT_ADDR);
  const Token = await ethers.getContractFactory("MockToken");
  const token = Token.attach(d.ASSET_ADDR);
  console.log("closed:", await vault.closed(), "| armed:", await vault.armed(),
    "| vault bal:", (await token.balanceOf(d.VAULT_ADDR)).toString(),
    "| owner bal:", (await token.balanceOf(await vault.owner())).toString());
})().catch(e => { console.error("ERR", e.message); process.exitCode = 1; });
