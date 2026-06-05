import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-ignition";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "london", // Cambiar de "cancun" a "london" para mejor compatibilidad con Besu
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.ETHEREUM_RPC_URL ?? (() => { throw new Error("ETHEREUM_RPC_URL is not set in environment variables"); })(),
      accounts: process.env.ETHEREUM_PRIVATE_KEY ? [process.env.ETHEREUM_PRIVATE_KEY] : [],
    },
    besu: {
      type: "http",
      url: process.env.BESU_RPC_URL ?? process.env.ETHEREUM_RPC_URL ?? "http://localhost:8545",
      accounts: process.env.ETHEREUM_PRIVATE_KEY ? [process.env.ETHEREUM_PRIVATE_KEY] : [],
    },
  },
};

export default config;
