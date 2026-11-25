// 1) owner 调 start() 在 Lasna 运行时新增订阅；
// 2) 在 Sepolia 触发 3 笔 MonitorToken 转账；
// 3) 轮询 Lasna 抓取 >=2 笔 react() (Triggered) 交易，并验证达到上限后自动退订。
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load } = require("./deployments");
const guard = require("./guard");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ABI = [
  "function start() payable",
  "function stop()",
  "function active() view returns (bool)",
  "function count() view returns (uint256)",
  "function maxTriggers() view returns (uint256)",
  "event Triggered(uint256 indexed n, uint256 sourceTx)",
  "event Subscribed()",
  "event Unsubscribed(string reason)",
];

async function main() {
  await guard(hre);
  const [sepoliaSigner] = await hre.ethers.getSigners();
  const { MONITOR_TOKEN_ADDR, DYNAMIC_SUB_ADDR } = load();
  if (!MONITOR_TOKEN_ADDR || !DYNAMIC_SUB_ADDR) throw new Error("deploy MonitorToken + DynamicSub first");

  const lasna = new ethers.JsonRpcProvider(process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/");
  const owner = new ethers.Wallet(process.env.REACTIVE_PK || process.env.SEPOLIA_PK, lasna);
  const sub = new ethers.Contract(DYNAMIC_SUB_ADDR, ABI, owner);
  console.log("owner:", owner.address, "sub:", DYNAMIC_SUB_ADDR);

  // 1) start() if not active
  const active0 = await sub.active();
  console.log("active before start:", active0);
  if (!active0) {
    const feeData = await lasna.getFeeData();
    const tip = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n
      ? feeData.maxPriorityFeePerGas
      : ethers.parseUnits("1", "gwei");
    const maxFee = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
    const tx = await sub.start({ value: 0, maxPriorityFeePerGas: tip, maxFeePerGas: maxFee });
    await tx.wait();
    console.log("start() tx (Lasna):", tx.hash);
  }
  console.log("active after start:", await sub.active(), "count:", (await sub.count()).toString());

  const fromBlock = await lasna.getBlockNumber();
  console.log("polling from Lasna block:", fromBlock);

  // 2) trigger 3 transfers on Sepolia
  const token = await hre.ethers.getContractAt("MonitorToken", MONITOR_TOKEN_ADDR, sepoliaSigner);
  const burner = "0x000000000000000000000000000000000000dEaD";
  const sepTxs = [];
  for (let i = 0; i < 3; i++) {
    const tx = await token.transfer(burner, ethers.parseEther("10"));
    await tx.wait();
    sepTxs.push(tx.hash);
    console.log(`Sepolia transfer[${i + 1}]:`, tx.hash);
  }

  // 3) poll Lasna for Triggered logs
  const iface = new ethers.Interface(ABI);
  const seen = new Set();
  const reactTxs = [];
  let done = false;
  for (let i = 0; i < 60 && !done; i++) {
    await sleep(3000);
    const logs = await lasna.getLogs({ address: DYNAMIC_SUB_ADDR, fromBlock, toBlock: "latest" });
    for (const l of logs) {
      if (seen.has(l.transactionHash)) continue;
      let parsed;
      try { parsed = iface.parseLog({ topics: l.topics, data: l.data }); } catch { continue; }
      if (parsed && parsed.name === "Triggered") {
        seen.add(l.transactionHash);
        reactTxs.push({ tx: l.transactionHash, block: l.blockNumber, n: parsed.args[0].toString(), src: "0x" + parsed.args[1].toString(16) });
      }
    }
    const cnt = (await sub.count()).toString();
    const act = await sub.active();
    console.log(`  [${i}] Triggered=${reactTxs.length} count=${cnt} active=${act}`);
    if (reactTxs.length >= 3 && !act) done = true;
  }

  console.log("=== FINAL STATE ===");
  console.log("count:", (await sub.count()).toString(), "max:", (await sub.maxTriggers()).toString(), "active:", await sub.active());
  console.log("=== EVIDENCE ===");
  console.log("DynamicSub (Lasna): https://lasna.reactscan.net/address/" + DYNAMIC_SUB_ADDR);
  reactTxs.forEach((r, i) => console.log(`react[${i + 1}] n=${r.n} block=${r.block} tx: https://lasna.reactscan.net/tx/${r.tx}`));
  sepTxs.forEach((h, i) => console.log(`Sepolia trigger[${i + 1}]: https://sepolia.etherscan.io/tx/${h}`));
  if (reactTxs.length < 2) console.log("WARNING: fewer than 2 react txs captured");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
