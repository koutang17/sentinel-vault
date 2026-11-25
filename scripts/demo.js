// End-to-end demo on Ethereum Sepolia: fund -> arm -> poke price -> watch the cross-chain
// callback close the vault. Prints an evidence block for the buildathon submission.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load } = require("./deployments");
const guard = require("./guard");

const U8 = (n) => BigInt(Math.round(n * 1e8)); // 8-decimal USD price
const U6 = (n) => BigInt(n) * 10n ** 6n;

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const { ORACLE_ADDR, ASSET_ADDR, VAULT_ADDR, REACTIVE_ADDR } = load();
  if (!ORACLE_ADDR || !ASSET_ADDR || !VAULT_ADDR || !REACTIVE_ADDR) throw new Error("run deploy scripts first");

  // A deployed reactive contract fires once. Check Lasna before sending any
  // Sepolia transactions so a repeat demo does not leave funds in an armed vault.
  const reactiveProvider = new ethers.JsonRpcProvider(process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/");
  const reactiveChain = await reactiveProvider.getNetwork();
  if (reactiveChain.chainId !== 5318007n) throw new Error("REACTIVE_RPC must point to Lasna (5318007)");
  const reactive = new ethers.Contract(
    REACTIVE_ADDR,
    ["function triggered() view returns (bool)", "function vault() view returns (address)"],
    reactiveProvider
  );
  if ((await reactive.vault()).toLowerCase() !== VAULT_ADDR.toLowerCase()) {
    throw new Error("reactive contract is not bound to this vault");
  }
  if (await reactive.triggered()) {
    throw new Error("reactive contract already fired; reset its thresholds on Lasna before rerunning the demo");
  }

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
  tx = await vault.arm(U8(0.95), U8(1.05));
  await tx.wait();
  console.log("armed SL=0.95 TP=1.05, tx:", tx.hash);

  console.log("== 3. poke price to 0.94 ==");
  tx = await oracle.setPrice(U8(0.94));
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
  const latest = await ethers.provider.getBlockNumber();
  const evs = await vault.queryFilter("VaultClosed", Math.max(0, latest - 9), latest);
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
  console.log("origin event chain:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("reactive contract :", REACTIVE_ADDR, "(Lasna 5318007)");
  console.log("vault contract    :", VAULT_ADDR, "(destination chain)");
  console.log("oracle price poke :", tx.hash);
  console.log("callback delivery :", ev.transactionHash);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
