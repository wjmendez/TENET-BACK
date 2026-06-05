import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Script para validar y verificar la clave privada configurada
 */

function validatePrivateKeyFormat(privateKey: string): { valid: boolean; error?: string; normalized?: string } {
  if (!privateKey || privateKey.length === 0) {
    return { valid: false, error: 'Private key is empty' };
  }

  let normalized = privateKey.trim();
  
  // Remover 0x si está presente
  if (normalized.startsWith('0x') || normalized.startsWith('0X')) {
    normalized = normalized.slice(2);
  }
  
  // Validar que sea hexadecimal
  if (!/^[0-9a-fA-F]+$/.test(normalized)) {
    return { 
      valid: false, 
      error: `Private key contains invalid characters. Only hexadecimal characters (0-9, a-f, A-F) are allowed.` 
    };
  }
  
  // Validar longitud (debe ser 64 caracteres = 32 bytes)
  if (normalized.length !== 64) {
    return { 
      valid: false, 
      error: `Invalid private key length. Expected 64 hex characters (32 bytes), got ${normalized.length} characters.` 
    };
  }
  
  return { valid: true, normalized: '0x' + normalized.toLowerCase() };
}

async function main() {
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
  
  if (!privateKey) {
    console.log(`❌ ETHEREUM_PRIVATE_KEY no está configurada en .env\n`);
    console.log(`💡 Agrega tu clave privada al archivo .env:`);
    console.log(`   ETHEREUM_PRIVATE_KEY=tu_clave_privada_64_caracteres_hex\n`);
    process.exit(1);
  }

  console.log(`🔍 Validando clave privada...\n`);
  console.log(`📝 Clave privada (primeros/last 10 chars): ${privateKey.substring(0, 10)}...${privateKey.substring(privateKey.length - 10)}`);
  console.log(`📏 Longitud: ${privateKey.length} caracteres\n`);

  // Validar formato
  const validation = validatePrivateKeyFormat(privateKey);
  
  if (!validation.valid) {
    console.log(`❌ Clave privada inválida: ${validation.error}\n`);
    console.log(`💡 La clave privada debe ser:`);
    console.log(`   - 64 caracteres hexadecimales (0-9, a-f, A-F)`);
    console.log(`   - Con o sin prefijo 0x`);
    console.log(`   - Sin espacios, saltos de línea u otros caracteres especiales\n`);
    console.log(`📋 Ejemplo de formato correcto:`);
    console.log(`   ETHEREUM_PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef\n`);
    process.exit(1);
  }

  console.log(`✅ Formato de clave privada válido\n`);

  // Intentar crear wallet para verificar que sea una clave válida
  try {
    const wallet = new ethers.Wallet(validation.normalized!);
    console.log(`✅ Clave privada es válida para ethers.js`);
    console.log(`📍 Wallet address: ${wallet.address}\n`);
    
    // Verificar balance si hay RPC configurado
    const rpcUrl = process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL;
    if (rpcUrl) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = Number(balance) / 1e18;
        console.log(`💰 Balance en ${rpcUrl}: ${balanceEth.toFixed(6)} ETH\n`);
        
        if (balance === 0n) {
          console.log(`⚠️  Este wallet no tiene fondos. Necesitas fondos para enviar transacciones.\n`);
        } else {
          console.log(`✅ Este wallet tiene fondos suficientes.\n`);
        }
      } catch (err: any) {
        console.log(`⚠️  No se pudo verificar balance: ${err.message}\n`);
      }
    } else {
      console.log(`💡 Para verificar el balance, configura BESU_RPC_URL o ETHEREUM_RPC_URL\n`);
    }
  } catch (err: any) {
    console.log(`❌ Error al crear wallet: ${err.message}\n`);
    console.log(`💡 La clave privada parece tener el formato correcto pero no es válida para ethers.js\n`);
    process.exit(1);
  }
}

main().catch(console.error);



