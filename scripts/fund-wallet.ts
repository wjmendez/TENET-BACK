import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

/**
 * Script para transferir ETH desde una cuenta pre-fundada de Besu
 * a tu wallet para poder desplegar contratos
 */
async function main() {
  const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545';
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
  const amount = process.env.FUND_AMOUNT || '10'; // ETH a transferir

  if (!privateKey) {
    throw new Error("ETHEREUM_PRIVATE_KEY must be set in environment variables");
  }

  console.log("💰 Funding wallet script for Besu local network\n");

  // Conectar a Besu
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("📍 Target wallet:", wallet.address);
  
  // Verificar balance actual
  const currentBalance = await provider.getBalance(wallet.address);
  const currentBalanceEth = ethers.formatEther(currentBalance);
  console.log("💰 Current balance:", currentBalanceEth, "ETH\n");

  if (currentBalance !== 0n) {
    console.log("✅ Wallet already has funds. No need to fund.");
    return;
  }

  // En Besu, las cuentas pre-fundadas suelen ser las primeras cuentas
  // Intentar usar la primera cuenta de eth_accounts
  console.log("🔍 Looking for pre-funded account...");
  
  try {
    const accounts = await provider.send("eth_accounts", []);
    
    if (accounts.length === 0) {
      throw new Error("No accounts found in Besu. Make sure Besu is running.");
    }

    // Usar la primera cuenta (normalmente pre-fundada en Besu)
    const fundedAccount = accounts[0];
    console.log("📦 Found pre-funded account:", fundedAccount);

    // Crear un signer para la cuenta pre-fundada
    // En Besu local, podemos usar eth_sendTransaction directamente
    // o necesitamos la clave privada de la cuenta pre-fundada
    
    // Intentar transferir usando eth_sendTransaction (si Besu lo permite)
    const txHash = await provider.send("eth_sendTransaction", [{
      from: fundedAccount,
      to: wallet.address,
      value: ethers.parseEther(amount).toString(),
      gas: "0x5208", // 21000
    }]);

    console.log("\n✅ Transfer sent!");
    console.log("📝 Transaction hash:", txHash);
    console.log("⏳ Waiting for confirmation...");

    // Esperar confirmación
    await provider.waitForTransaction(txHash);
    
    // Verificar nuevo balance
    const newBalance = await provider.getBalance(wallet.address);
    const newBalanceEth = ethers.formatEther(newBalance);
    
    console.log("\n✅ Transfer confirmed!");
    console.log("💰 New balance:", newBalanceEth, "ETH");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.log("\n💡 Alternative solutions:");
    console.log("1. Use MetaMask to transfer ETH:");
    console.log("   - Connect MetaMask to Besu (Chain ID: 2025)");
    console.log("   - Import the pre-funded account if you have its private key");
    console.log("   - Transfer ETH to:", wallet.address);
    console.log("\n2. Use a pre-funded account directly:");
    console.log("   - Find the private key of a pre-funded account");
    console.log("   - Set it as ETHEREUM_PRIVATE_KEY in .env");
    console.log("\n3. Check Besu genesis file:");
    console.log("   - Look for pre-funded accounts in genesis.json");
    console.log("   - Use one of those accounts' private keys");
  }
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exitCode = 1;
});




