// Generates a fresh, empty wallet for testnet use ONLY.
// The private key is written to .env and wallet-info.local.txt (both gitignored)
// and is never printed to the console.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const wallet = ethers.Wallet.createRandom();
  const root = path.join(__dirname, "..");

  const envPath = path.join(root, ".env");
  let env = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : fs.readFileSync(path.join(root, ".env.example"), "utf8");
  env = env
    .replace(/^DEST_PK=.*$/m, "DEST_PK=" + wallet.privateKey)
    .replace(/^REACTIVE_PK=.*$/m, "REACTIVE_PK=" + wallet.privateKey);
  fs.writeFileSync(envPath, env);

  const info = [
    "TESTNET ONLY wallet (no real funds; never import into anything mainnet)",
    "address: " + wallet.address,
    "private key: " + wallet.privateKey,
    "mnemonic phrase: " + wallet.mnemonic.phrase,
    ""
  ].join(String.fromCharCode(10));
  fs.writeFileSync(path.join(root, "wallet-info.local.txt"), info);

  console.log("wallet address:", wallet.address);
  console.log("private key written to .env and wallet-info.local.txt (both gitignored; not printed)");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
