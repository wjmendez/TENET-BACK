
import * as dotenv from "dotenv";
dotenv.config();

import { ethers, ContractFactory } from "ethers";
import MerkleAnchorJson from "../artifacts/contracts/MerkleAnchor.sol/MerkleAnchor.json" with { type: "json" };

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL as string);
  const wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY as string, provider);
  const MerkleAnchorFactory = new ContractFactory(
    MerkleAnchorJson.abi,
    MerkleAnchorJson.bytecode,
    wallet
  );
  const contract = await MerkleAnchorFactory.deploy();
  await contract.waitForDeployment();
  console.log("MerkleAnchor deployed to:", await contract.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
