import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Script para generar una nueva clave privada y wallet
 * Útil si no tienes acceso a la clave privada de la cuenta pre-fundada
 */

async function main() {
  console.log(`🔑 Generando nueva clave privada y wallet...\n`);

  // Generar nueva wallet
  const wallet = ethers.Wallet.createRandom();
  
  console.log(`✅ Nueva wallet generada:\n`);
  console.log(`📍 Address: ${wallet.address}`);
  console.log(`🔑 Private Key: ${wallet.privateKey}`);
  console.log(`   (64 caracteres hex, lista para usar en .env)\n`);

  // Verificar balance si hay RPC configurado
  const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL;
  if (rpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const balance = await provider.getBalance(wallet.address);
      const balanceEth = Number(balance) / 1e18;
      
      console.log(`💰 Balance en ${rpcUrl}: ${balanceEth.toFixed(6)} ETH\n`);
      
      if (balance === 0n) {
        console.log(`⚠️  Esta nueva wallet no tiene fondos.\n`);
        console.log(`💡 Para usar esta wallet:`);
        console.log(`   1. Agrega esta línea a tu .env:`);
        console.log(`      ETHEREUM_PRIVATE_KEY=${wallet.privateKey.slice(2)}\n`);
        console.log(`   2. Transfiere ETH desde la cuenta pre-fundada:`);
        console.log(`      - Address pre-fundada: 0x44d192c0080b0644cb5c648ced6c5373979f748b`);
        console.log(`      - Nuevo wallet: ${wallet.address}`);
        console.log(`      - Usa MetaMask o un script de transferencia\n`);
      }
    } catch (err: any) {
      console.log(`⚠️  No se pudo verificar balance: ${err.message}\n`);
    }
  }

  console.log(`📋 Para usar esta wallet, agrega a tu .env:`);
  console.log(`   ETHEREUM_PRIVATE_KEY=${wallet.privateKey.slice(2)}\n`);
  console.log(`⚠️  IMPORTANTE: Guarda esta clave privada de forma segura!`);
  console.log(`   Si la pierdes, no podrás acceder a esta wallet.\n`);
}

main().catch(console.error);



