import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

console.log("ETHEREUM_PRIVATE_KEY:", process.env.ETHEREUM_PRIVATE_KEY);

async function main() {
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
  if (!privateKey) throw new Error("No private key found");
  const wallet = new ethers.Wallet(privateKey);
  console.log("Wallet address:", wallet.address);
}

main().catch(console.error);
