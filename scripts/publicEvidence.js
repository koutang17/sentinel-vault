// Public, read-only proof of the published Sepolia -> Lasna -> Sepolia run.
// No private key, .env, Hardhat artifacts, or local deployment file is needed.
const ethers = require("ethers");

const ETH_RPC = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const LASNA_RPC = process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/";

const ADDR = {
  oracle: "0x5042cB9256E8F722263A29Ea2334C2eBD7B85979",
  token: "0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB",
  vault: "0x3a5820b60499dD05548055eeA21B786EA31F3826",
  reactive: "0x31297a441F9EC94B34236344ea5F1cE6EC001614",
};
const TX = {
  source: "0x5b954e5f4fe9e13bb999eb2a1ec7a8d0994c5b19b1daef1d408b8712853bc4ee",
  reactive: "0x4c91ad1c838ab9dcceea0e4d3a9bd091442777e2df8868a5e8e234e4034757ae",
  callback: "0x441b18f6417a5302aa54360a78f3e256426e6e1fbffd6cb8fd1dde3188da0676",
};
const abi = new ethers.Interface([
  "event PriceUpdated(uint256 indexed price, uint256 indexed timestamp)",
  "event Triggered(uint256 price, string reason)",
  "event VaultClosed(address indexed owner, uint256 exitPrice, uint256 reportedPrice, string reason)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function closed() view returns (bool)",
  "function armed() view returns (bool)",
  "function triggered() view returns (bool)",
  "function vault() view returns (address)",
  "function balanceOf(address) view returns (uint256)",
]);

function same(a, b) { return a.toLowerCase() === b.toLowerCase(); }
function check(ok, message) { if (!ok) throw new Error(message); }
function price(p) { return (Number(p) / 1e8).toFixed(2); }
function receiptEvent(receipt, address, name) {
  for (const log of receipt.logs) {
    if (!same(log.address, address)) continue;
    try {
      const parsed = abi.parseLog(log);
      if (parsed?.name === name) return parsed.args;
    } catch { /* another event from this contract */ }
  }
  throw new Error(name + " event missing from " + receipt.hash);
}
async function retry(label, fn) {
  let error;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await fn(); } catch (e) {
      error = e;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 600));
    }
  }
  throw new Error(label + ": " + error.message);
}
async function view(provider, address, name, args = []) {
  const result = await retry(name, () => provider.call({ to: address, data: abi.encodeFunctionData(name, args) }));
  return abi.decodeFunctionResult(name, result)[0];
}

async function main() {
  const eth = new ethers.JsonRpcProvider(ETH_RPC);
  const lasna = new ethers.JsonRpcProvider(LASNA_RPC);
  console.log("SENTINEL VAULT | PUBLIC TESTNET EVIDENCE");
  console.log("Read-only. No wallet, private key, or transaction is used.\n");
  const [ethChain, lasnaChain] = await Promise.all([
    retry("Sepolia chain ID", () => eth.send("eth_chainId", [])),
    retry("Lasna chain ID", () => lasna.send("eth_chainId", [])),
  ]);
  check(BigInt(ethChain) === 11155111n, "SEPOLIA_RPC is not Ethereum Sepolia");
  check(BigInt(lasnaChain) === 5318007n, "REACTIVE_RPC is not Lasna");

  const source = await retry("source receipt", () => eth.getTransactionReceipt(TX.source));
  check(source?.status === 1, "source transaction is missing or failed");
  const src = receiptEvent(source, ADDR.oracle, "PriceUpdated");
  console.log("[1/4] ETHEREUM SEPOLIA | SOURCE EVENT");
  console.log("  tx      " + TX.source);
  console.log("  status  SUCCESS | block " + source.blockNumber);
  console.log("  event   PriceUpdated(" + src.price + ") = " + price(src.price) + " USD\n");

  const reaction = await retry("reactive receipt", () => lasna.getTransactionReceipt(TX.reactive));
  check(reaction?.status === 1, "reactive transaction is missing or failed");
  const triggered = receiptEvent(reaction, ADDR.reactive, "Triggered");
  check(triggered.price === src.price && triggered.reason === "STOP", "reactive event does not match source");
  console.log("[2/4] REACTIVE LASNA | THRESHOLD CROSSED");
  console.log("  tx      " + TX.reactive);
  console.log("  status  SUCCESS | block " + reaction.blockNumber);
  console.log("  event   Triggered(" + price(triggered.price) + ", " + triggered.reason + ")\n");

  const callback = await retry("callback receipt", () => eth.getTransactionReceipt(TX.callback));
  check(callback?.status === 1, "callback transaction is missing or failed");
  const closed = receiptEvent(callback, ADDR.vault, "VaultClosed");
  check(closed.exitPrice === src.price && closed.reportedPrice === src.price && closed.reason === "STOP", "callback event does not match trigger");
  const transfer = receiptEvent(callback, ADDR.token, "Transfer");
  check(same(transfer.from, ADDR.vault) && same(transfer.to, closed.owner) && transfer.value === 500000000n, "500 sUSD return transfer not found");
  console.log("[3/4] ETHEREUM SEPOLIA | CALLBACK EXECUTED");
  console.log("  tx      " + TX.callback);
  console.log("  status  SUCCESS | block " + callback.blockNumber);
  console.log("  event   VaultClosed(" + price(closed.exitPrice) + ", " + closed.reason + ")");
  console.log("  token   500 sUSD transferred from vault to owner\n");

  const [vaultClosed, vaultArmed, reactiveTriggered, boundVault, vaultBalance, ownerBalance] = await Promise.all([
    view(eth, ADDR.vault, "closed"), view(eth, ADDR.vault, "armed"),
    view(lasna, ADDR.reactive, "triggered"), view(lasna, ADDR.reactive, "vault"),
    view(eth, ADDR.token, "balanceOf", [ADDR.vault]),
    view(eth, ADDR.token, "balanceOf", [closed.owner]),
  ]);
  check(vaultClosed && !vaultArmed && reactiveTriggered && same(boundVault, ADDR.vault), "current contract state is inconsistent");
  console.log("[4/4] CURRENT STATE | READ FROM BOTH CHAINS");
  console.log("  vault.closed      " + vaultClosed + " | vault.armed " + vaultArmed);
  console.log("  reactive.triggered " + reactiveTriggered + " | vault binding OK");
  console.log("  vault sUSD        " + ethers.formatUnits(vaultBalance, 6));
  console.log("  owner sUSD        " + ethers.formatUnits(ownerBalance, 6) + "\n");
  console.log("REACTSCAN TRACE (source event -> reaction -> confirmed callback)");
  console.log("  https://lasna.reactscan.net/tx/" + TX.reactive);
  console.log("PASS | published cross-chain loop and token return verified");
}

main().catch(e => { console.error("FAIL | " + e.message); process.exitCode = 1; });
