require("@nomicfoundation/hardhat-toolbox");

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { allowUnlimitedContractSize: false },
    // Fill these in from Robinhood Chain's official docs before deploying.
    robinhoodTestnet: {
      url: process.env.RH_TESTNET_RPC || "",
      chainId: process.env.RH_TESTNET_CHAIN_ID ? Number(process.env.RH_TESTNET_CHAIN_ID) : undefined,
      accounts,
    },
    robinhood: {
      url: process.env.RH_MAINNET_RPC || "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts,
    },
  },
  // Source verification on the Robinhood Chain Blockscout explorer (no API key needed).
  etherscan: {
    apiKey: { robinhood: "blockscout" },
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: { apiURL: "https://robinhoodchain.blockscout.com/api", browserURL: "https://robinhoodchain.blockscout.com" },
      },
    ],
  },
  sourcify: { enabled: false },
  mocha: { timeout: 600000 },
};
