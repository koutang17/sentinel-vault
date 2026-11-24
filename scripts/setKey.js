// Reads private_key.txt (you create it with Notepad), validates it, writes .env,
// records only the address in wallet-info.local.txt, then deletes the temp file.
// Usage:  node scripts/setKey.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const root = path.join(__dirname, "..");
const src = path.join(root, "private_key.txt");
if (!fs.existsSync(src)) { console.error("missing private_key.txt in " + root); process.exit(1); }

let k = fs.readFileSync(src, "utf8").trim().replace(/^0x/, "");
if (!/^[0-9a-fA-F]{64}$/.test(k)) { console.error("not a valid 32-byte hex private key"); process.exit(1); }

const wallet = new ethers.Wallet("0x" + k);
const envPath = path.join(root, ".env");
let env = fs.readFileSync(envPath, "utf8")
  .replace(/^DEST_PK=.*$/m, "DEST_PK=0x" + k)
  .replace(/^REACTIVE_PK=.*$/m, "REACTIVE_PK=0x" + k);
fs.writeFileSync(envPath, env);

fs.writeFileSync(path.join(root, "wallet-info.local.txt"),
  "wallet in use: " + wallet.address + "\r\n" +
  "(private key lives only in .env; both files gitignored; never commit, never paste in chat)\r\n");
fs.unlinkSync(src);
console.log("key installed for address:", wallet.address);
console.log("private_key.txt deleted");
