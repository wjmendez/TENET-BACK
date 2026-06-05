import * as dotenv from "dotenv";
dotenv.config();

import { ethers, ContractFactory, Contract } from "ethers";
import CertificateNFTJson from "../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json" with { type: "json" };

/**
 * Script para desplegar NFT en Besu usando una cuenta pre-fundada
 * Si tu wallet no tiene fondos, este script usará una cuenta pre-fundada conocida de Besu
 */
async function main() {
  const rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545';
  
  // Direcciones de cuentas pre-fundadas encontradas en Besu
  // Para usar estas cuentas, necesitas su clave privada (ver BESU_FUNDING.md)
  const preFundedAddresses = [
    '0x627306090abaB3A6e1400e9345bC60c78a8BEf57',
    '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
  ];
  
  // Si tienes la clave privada de una cuenta pre-fundada, úsala aquí
  // O configúrala en .env como BESU_PRE_FUNDED_KEY
  const preFundedKey = process.env.BESU_PRE_FUNDED_KEY;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Intentar usar ETHEREUM_PRIVATE_KEY primero, si tiene fondos
  let deployerPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
  let usePreFunded = false;
  let selectedAccount = null;

  if (deployerPrivateKey) {
    const wallet = new ethers.Wallet(deployerPrivateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    
    if (balance > 0n) {
      console.log("✅ Using configured wallet with funds");
      console.log("📍 Address:", wallet.address);
      console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");
    } else {
      console.log("⚠️  Configured wallet has no funds");
      console.log("🔍 Checking for pre-funded accounts in Besu...\n");
      
      // Mostrar cuentas pre-fundadas encontradas
      for (const address of preFundedAddresses) {
        const balance = await provider.getBalance(address);
        if (balance > 0n) {
          console.log(`💰 Found pre-funded account: ${address} (${ethers.formatEther(balance)} ETH)`);
        }
      }
      
      // Si hay una clave pre-fundada configurada, usarla
      if (preFundedKey) {
        console.log("\n✅ Using BESU_PRE_FUNDED_KEY from .env");
        deployerPrivateKey = preFundedKey;
        usePreFunded = true;
      } else {
        console.log("\n❌ No funds available and no BESU_PRE_FUNDED_KEY configured.");
        console.log("\n💡 Solutions:");
        console.log("1. Use MetaMask to transfer ETH:");
        console.log("   - Connect MetaMask to Besu (Chain ID: 2025, RPC: http://localhost:8545)");
        console.log("   - Import a pre-funded account if you have its private key");
        console.log("   - Transfer 1-2 ETH to:", wallet.address);
        console.log("\n2. Use a pre-funded account directly:");
        console.log("   - Get the private key of a pre-funded account");
        console.log("   - Set it in .env: BESU_PRE_FUNDED_KEY=<private_key>");
        console.log("   - Or set it as: ETHEREUM_PRIVATE_KEY=<private_key>");
        console.log("\n3. Check Besu configuration:");
        console.log("   - Look for genesis.json or Besu config files");
        console.log("   - Find pre-funded accounts and their private keys");
        throw new Error("Please fund your wallet or configure BESU_PRE_FUNDED_KEY");
      }
    }
  } else {
    console.log("ℹ️  No ETHEREUM_PRIVATE_KEY configured");
    
    // Si hay una clave pre-fundada configurada, usarla
    if (preFundedKey) {
      console.log("✅ Using BESU_PRE_FUNDED_KEY from .env\n");
      deployerPrivateKey = preFundedKey;
      usePreFunded = true;
    } else {
      console.log("🔍 Checking for pre-funded accounts in Besu...\n");
      
      // Mostrar cuentas pre-fundadas encontradas
      for (const address of preFundedAddresses) {
        const balance = await provider.getBalance(address);
        if (balance > 0n) {
          console.log(`💰 Found pre-funded account: ${address} (${ethers.formatEther(balance)} ETH)`);
        }
      }
      
      console.log("\n❌ No BESU_PRE_FUNDED_KEY configured.");
      console.log("\n💡 Solutions:");
      console.log("1. Set BESU_PRE_FUNDED_KEY in .env with a pre-funded account's private key");
      console.log("2. Or set ETHEREUM_PRIVATE_KEY with a funded account");
      console.log("3. Or use MetaMask to transfer ETH to your wallet");
      throw new Error("Please configure ETHEREUM_PRIVATE_KEY or BESU_PRE_FUNDED_KEY");
    }
  }

  const wallet = new ethers.Wallet(deployerPrivateKey!, provider);
  const balance = await provider.getBalance(wallet.address);
  
  if (balance === 0n) {
    throw new Error("No funds available. Please fund your wallet or use a pre-funded account.");
  }

  console.log("🚀 Deploying CertificateNFT contract to Besu...");
  console.log("📡 RPC URL:", rpcUrl);
  console.log("📍 Deployer address:", wallet.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  // Owner inicial: usar NFT_OWNER_ADDRESS o la dirección del deployer
  const initialOwner = process.env.NFT_OWNER_ADDRESS || wallet.address;
  console.log("👤 Initial Owner:", initialOwner);

  if (usePreFunded) {
    console.log("\n⚠️  NOTE: Using pre-funded account for deployment.");
    console.log("   The contract owner will be:", initialOwner);
    console.log("   (You can change this by setting NFT_OWNER_ADDRESS in .env)");
    console.log("   For production, use your own funded wallet.\n");
  }

  // Crear factory del contrato
  const CertificateNFTFactory = new ContractFactory(
    CertificateNFTJson.abi,
    CertificateNFTJson.bytecode,
    wallet
  );

  console.log("📝 Deploying contract...");
  
  // Desplegar sin parámetros (el constructor no los necesita)
  // Especificar gas manualmente para evitar problemas con estimateGas en Besu
  const gasLimit = 5000000n; // 5M gas (suficiente para contratos ERC721)
  
  console.log("⛽ Using gas limit:", gasLimit.toString());
  
  const contract = await CertificateNFTFactory.deploy({
    gasLimit: gasLimit
  });
  
  console.log("⏳ Waiting for deployment transaction...");
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  
  console.log("\n✅ CertificateNFT deployed successfully to Besu!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("👤 Initial Owner:", initialOwner);
  
  console.log("\n📋 Add this to your .env file:");
  console.log(`NFT_CONTRACT_ADDRESS=${contractAddress}`);
  
  // Verificar el deployment
  try {
    const deployedContract = new Contract(contractAddress, CertificateNFTJson.abi, wallet) as Contract & {
      nextTokenId: () => Promise<bigint>;
      owner: () => Promise<string>;
    };
    const nextTokenId = await deployedContract.nextTokenId();
    const owner = await deployedContract.owner();
    console.log("\n🔍 Verification:");
    console.log("   Next Token ID:", nextTokenId.toString());
    console.log("   Contract owner:", owner);
    console.log("   ✅ Contract is working correctly!");
  } catch (error: any) {
    console.warn("⚠️  Could not verify contract:", error.message);
  }

  if (usePreFunded) {
    console.log("\n💡 IMPORTANT: You used a pre-funded account for deployment.");
    console.log("   For production, use your own wallet with funds.");
    console.log("   The contract is deployed and ready to use!");
  }
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exitCode = 1;
});

