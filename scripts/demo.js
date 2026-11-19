// End-to-end demo on Base Sepolia: fund -> arm -> poke price -> watch the cross-chain
// callback close the vault. Prints an evidence block for the buildathon submission.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load } = require("./deployments");
const guard = require("./guard");

const U8 = (n) => BigInt(n) * 10n ** 8n;
const U6 = (n) => BigInt(n) * 10n ** 6n;

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const { ORACLE_ADDR, ASSET_ADDR, VAULT_ADDR, REACTIVE_ADDR } = load();
  if (!ORACLE_ADDR || !ASSET_ADDR || !VAULT_ADDR) throw new Error("run deploy scripts first");

  const Oracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = Oracle.attach(ORACLE_ADDR);
  const Token = await hre.ethers.getContractFactory("MockToken");
  const token = Token.attach(ASSET_ADDR);
  const Vault = await hre.ethers.getContractFactory("SentinelVault");
  const vault = Vault.attach(VAULT_ADDR);

  console.log("== 1. fund ==");
  let tx = await token.mint(deployer.address, U6(500));
  await tx.wait();
  tx = await token.approve(VAULT_ADDR, U6(500));
  await tx.wait();
  tx = await vault.deposit(U6(500));
  await tx.wait();
  console.log("deposited 500 sUSD, tx:", tx.hash);

  console.log("== 2. arm ==");
  tx = await vault.arm(U8(95), U8(105));
  await tx.wait();
  console.log("armed SL=0.95 TP=1.05, tx:", tx.hash);

  console.log("== 3. poke price to 0.94 ==");
  tx = await oracle.setPrice(U8(94));
  await tx.wait();
  console.log("price poke tx:", tx.hash);

  console.log("== 4. wait for the callback ==");
  for (let i = 0; i < 40; i++) {
    if (await vault.closed()) break;
    await new Promise((r) => setTimeout(r, 3000));
    process.stdout.write(".");
  }
  console.log();
  if (!(await vault.closed())) {
    console.log("TIMEOUT: vault not closed. Check lREACT balance of the reactive contract and its funding.");
    return;
  }
  const evs = await vault.queryFilter("VaultClosed");
  const ev = evs[evs.length - 1];
  console.log("== 5. result ==");
  console.log(JSON.stringify({
    reason: ev.args.reason,
    exitPrice: ev.args.exitPrice.toString(),
    reportedPrice: ev.args.reportedPrice.toString(),
    owner: ev.args.owner,
    vaultClosedTx: ev.transactionHash,
  }, null, 2));
  console.log("== submission evidence ==");
  console.log("origin event chain: Base Sepolia");
  console.log("reactive contract :", REACTIVE_ADDR, "(Lasna)");
  console.log("vault contract    :", VAULT_ADDR, "(Base Sepolia)");
  console.log("oracle price poke :", tx.hash);
  console.log("callback delivery :", ev.transactionHash);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
