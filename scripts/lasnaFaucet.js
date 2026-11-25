// Funds the Lasna faucet: sends testnet ETH to the Lasna faucet contract.
//   npm run faucet                -> via Ethereum Sepolia (needs SEPOLIA_RPC in .env)
//   node scripts/lasnaFaucet.js --chain base -> via Base Sepolia
// 1 ETH -> 100 lREACT. Cap is 5 ETH per transfer. Testnet only: the chain id
// of the chosen network is checked before any transaction.
const ethers = require("ethers");
require("dotenv").config();

const CHAINS = {
  base: {
    name: "Base Sepolia",
    rpc: "https://sepolia.base.org",
    chainId: 84532n,
    faucet: "0x2afaFD298b23b62760711756088F75B7409f5967",
  },
  eth: {
    name: "Ethereum Sepolia",
    rpc: process.env.SEPOLIA_RPC || "",
    chainId: 11155111n,
    faucet: "0x9b9BB25f1A81078C544C829c5EB7822d747Cf434",
  },
};

const AMOUNT = ethers.parseEther("0.02"); // 0.02 ETH -> ~2 lREACT (enough for deploy + calls)

async function main() {
  const chainArg = process.argv.find((a) => a.startsWith("--chain"));
  const key = chainArg ? chainArg.split("=")[1] || process.argv[process.argv.indexOf(chainArg) + 1] : "base";
  const chain = CHAINS[key];
  if (!chain) throw new Error("unsupported faucet chain: " + key + " (use eth or base)");
  if (!chain.rpc) throw new Error("chain " + key + " has no RPC configured (SEPOLIA_RPC missing?)");
  if (!process.env.DEST_PK) throw new Error("DEST_PK missing in .env");

  const provider = new ethers.JsonRpcProvider(chain.rpc);
  const { chainId } = await provider.getNetwork();
  if (chainId !== chain.chainId) {
    throw new Error("refusing: expected " + chain.name + " (" + chain.chainId + "), got " + chainId);
  }
  const wallet = new ethers.Wallet(process.env.DEST_PK, provider);
  const bal = await provider.getBalance(wallet.address);
  console.log("chain   :", chain.name);
  console.log("wallet  :", wallet.address);
  console.log("balance :", ethers.formatEther(bal), "ETH");
  if (bal < AMOUNT + 100000000000000n) throw new Error("not enough " + chain.name + " ETH - claim from the faucet first");
  const tx = await wallet.sendTransaction({ to: chain.faucet, value: AMOUNT });
  console.log("faucet tx:", tx.hash);
  await tx.wait();
  console.log("sent", ethers.formatEther(AMOUNT), "ETH -> expect ~2 lREACT on the same address (Lasna)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
