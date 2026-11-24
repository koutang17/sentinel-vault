// Testnet-only enforcement. Every deploy/demo script calls this first.
// A wrong RPC endpoint (mainnet) aborts the script before any transaction is sent.
module.exports = async function guard(hre) {
  const ALLOWED = [84532n, 11155111n, 5318007n, 31337n]; // Base Sepolia, Eth Sepolia, Lasna, hardhat
  const { chainId } = await hre.ethers.provider.getNetwork();
  if (!ALLOWED.includes(chainId)) {
    throw new Error(
      "refusing to run on chain " + chainId + ": Sentinel Vault is testnet-only. " +
      "Check DEST_RPC / REACTIVE_RPC in .env."
    );
  }
  return chainId;
};
