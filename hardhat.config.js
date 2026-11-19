require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

module.exports = {
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
    "base-sepolia": {
      url: process.env.DEST_RPC || "",
      chainId: 84532,
      accounts: process.env.DEST_PK ? [process.env.DEST_PK] : [],
    },
    lasna: {
      url: "https://lasna-rpc.rnk.dev/",
      chainId: 5318007,
      accounts: process.env.REACTIVE_PK ? [process.env.REACTIVE_PK] : [],
    },
  },
  mocha: { timeout: 120000 },
};

