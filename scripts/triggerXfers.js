// 在 Sepolia 触发一笔 MonitorToken 转账，然后在 Lasna 轮询抓到 react() 交易。
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { load } = require("./deployments");
const guard = require("./guard");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await guard(hre);
  const [deployer] = await hre.ethers.getSigners();
  const { MONITOR_TOKEN_ADDR, XFERS_ADDR } = load();
  if (!MONITOR_TOKEN_ADDR || !XFERS_ADDR) throw new Error("deploy MonitorToken and Xfers first");

  const token = await hre.ethers.getContractAt("MonitorToken", MONITOR_TOKEN_ADDR, deployer);
  const burner = "0x000000000000000000000000000000000000dEaD";
  const amount = ethers.parseEther("100");
  console.log("sending Sepolia transfer of 100 MON to", burner);
  const tx = await token.transfer(burner, amount);
  const receipt = await tx.wait();
  console.log("Sepolia trigger tx:", tx.hash, "block:", receipt.blockNumber);

  const lasna = new ethers.JsonRpcProvider(process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/");
  const abi = [
    "function lastTxHash() view returns (uint256)",
    "function lastReactBlockNumber() view returns (uint256)",
    "function limit() view returns (uint256)",
    "event Turnover(address indexed token_, uint256 indexed volume_)",
  ];
  const xfers = new ethers.Contract(XFERS_ADDR, abi, lasna);
  const fromBlock = await lasna.getBlockNumber();
  console.log("polling Lasna for react() ... fromBlock", fromBlock);

  let reactTx = null;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    try {
      const lastHash = await xfers.lastTxHash();
      const matched = lastHash === BigInt(tx.hash);
      const lim = await xfers.limit();
      console.log(`  [${i}] limit=${lim} matchedTx=${matched}`);
      if (matched) {
        const logs = await lasna.getLogs({ address: XFERS_ADDR, fromBlock, toBlock: "latest" });
        console.log("  Turnover logs found:", logs.length);
        if (logs.length) { reactTx = logs[logs.length - 1].transactionHash; break; }
      }
    } catch (e) {
      console.log("  poll err:", e.shortMessage || e.message);
    }
  }

  if (!reactTx) {
    const logs = await lasna.getLogs({ address: XFERS_ADDR, fromBlock, toBlock: "latest" });
    if (logs.length) reactTx = logs[logs.length - 1].transactionHash;
  }

  console.log("=== EVIDENCE ===");
  console.log("Xfers (Lasna):      https://lasna.reactscan.net/address/" + XFERS_ADDR);
  console.log("Sepolia trigger tx: https://sepolia.etherscan.io/tx/" + tx.hash);
  if (reactTx) console.log("react() tx (Lasna): https://lasna.reactscan.net/tx/" + reactTx);
  else console.log("react() tx: NOT FOUND within polling window");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
