import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

/**
 * Script específico para Besu: Busca cuentas con fondos y transfiere ETH
 * a tu wallet para poder desplegar contratos
 */
async function main() {
  const rpcUrl = process.env.BESU_RPC_URL || 'http://localhost:8545';
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
  const amount = process.env.FUND_AMOUNT || '10'; // ETH a transferir

  if (!privateKey) {
    throw new Error("ETHEREUM_PRIVATE_KEY must be set in environment variables");
  }

  console.log("💰 Funding wallet for Besu deployment\n");
  console.log("📡 RPC URL:", rpcUrl);

  // Conectar a Besu
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("📍 Target wallet:", wallet.address);
  
  // Verificar balance actual
  const currentBalance = await provider.getBalance(wallet.address);
  const currentBalanceEth = ethers.formatEther(currentBalance);
  console.log("💰 Current balance:", currentBalanceEth, "ETH\n");

  if (currentBalance !== 0n) {
    console.log("✅ Wallet already has funds. Ready to deploy!");
    return;
  }

  console.log("🔍 Searching for accounts with funds in Besu...\n");

  // En Besu, las cuentas pre-fundadas suelen tener direcciones conocidas
  // Intentar algunas direcciones comunes de cuentas pre-fundadas
  const commonPreFundedAddresses = [
    '0x627306090abaB3A6e1400e9345bC60c78a8BEf57', // Cuenta común en Besu
    '0xf17f52151EbEF6C7334FAD080c5704D77216b732',
    '0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef',
    '0x821aEa9a577a9b44299B9c15c88cf3087F3b5544',
    '0x0d1d4e623D10F9FBA5Db95830F7d3839406C6AF2',
  ];

  let fundedAccount: string | null = null;
  let fundedBalance: bigint = 0n;

  // Buscar cuentas con fondos
  for (const address of commonPreFundedAddresses) {
    try {
      const balance = await provider.getBalance(address);
      if (balance > 0n) {
        const balanceEth = ethers.formatEther(balance);
        console.log(`✅ Found funded account: ${address} (${balanceEth} ETH)`);
        if (balance > fundedBalance) {
          fundedAccount = address;
          fundedBalance = balance;
        }
      }
    } catch (error) {
      // Continuar buscando
    }
  }

  if (!fundedAccount) {
    console.log("\n❌ No pre-funded accounts found automatically.");
    console.log("\n💡 Solutions for Besu:");
    console.log("\n1. **Use MetaMask (Easiest):**");
    console.log("   - Connect MetaMask to Besu (Chain ID: 2025)");
    console.log("   - Import a pre-funded account if you have its private key");
    console.log("   - Transfer ETH to:", wallet.address);
    console.log("\n2. **Find pre-funded account in Besu config:**");
    console.log("   - Check Besu genesis.json or config files");
    console.log("   - Look for 'alloc' section with pre-funded accounts");
    console.log("   - Use that account's private key as ETHEREUM_PRIVATE_KEY");
    console.log("\n3. **Use a known pre-funded account:**");
    console.log("   - If you know a pre-funded account's private key,");
    console.log("   - Set it as ETHEREUM_PRIVATE_KEY in .env");
    console.log("   - Then deploy the contract");
    console.log("\n4. **Check Besu logs:**");
    console.log("   - Besu logs may show pre-funded accounts");
    console.log("   - Or check docker-compose if Besu runs in Docker");
    return;
  }

  console.log(`\n📦 Using funded account: ${fundedAccount}`);
  console.log(`💰 Balance: ${ethers.formatEther(fundedBalance)} ETH`);

  // Intentar transferir usando eth_sendTransaction
  // Esto requiere que la cuenta esté desbloqueada en Besu
  console.log("\n🔄 Attempting to transfer ETH...");
  
  try {
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
    console.log("\n🚀 Ready to deploy NFT contract!");
    
  } catch (error: any) {
    console.error("\n❌ Transfer failed:", error.message);
    console.log("\n💡 The account is not unlocked in Besu.");
    console.log("\n📋 Manual steps:");
    console.log("1. Get the private key of:", fundedAccount);
    console.log("2. Use MetaMask:");
    console.log("   - Connect to Besu (Chain ID: 2025)");
    console.log("   - Import account with private key");
    console.log("   - Transfer ETH to:", wallet.address);
    console.log("\n3. Or update .env to use the pre-funded account:");
    console.log("   ETHEREUM_PRIVATE_KEY=<private_key_of_pre_funded_account>");
  }
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exitCode = 1;
});




