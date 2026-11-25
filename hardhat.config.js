require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

module.exports = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.8.29",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    "eth-sepolia": {
      url: process.env.SEPOLIA_RPC || "",
      chainId: 11155111,
      accounts: process.env.DEST_PK ? [process.env.DEST_PK] : [],
    },
    "base-sepolia": {
      url: process.env.DEST_RPC || "",
      chainId: 84532,
      accounts: process.env.DEST_PK ? [process.env.DEST_PK] : [],
    },
    lasna: {
      url: process.env.REACTIVE_RPC || "https://lasna-rpc.rnk.dev/",
      chainId: 5318007,
      accounts: process.env.REACTIVE_PK ? [process.env.REACTIVE_PK] : [],
    },
  },
  mocha: { timeout: 120000 },
};

