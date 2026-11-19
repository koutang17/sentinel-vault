// Binds the vault address on the reactive contract (Lasna). Owner-only.
const hre = require("hardhat");
const { load } = require("./deployments");
const guard = require("./guard");

async function main() {
  await guard(hre);
  const { REACTIVE_ADDR, VAULT_ADDR } = load();
  if (!REACTIVE_ADDR || !VAULT_ADDR) throw new Error("missing addresses in deployments.local.json");
  const Reactive = await hre.ethers.getContractFactory("SentinelReactive");
  const reactive = Reactive.attach(REACTIVE_ADDR);
  const tx = await reactive.setVault(VAULT_ADDR);
  await tx.wait();
  console.log("bound vault:", VAULT_ADDR, "tx:", tx.hash);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
