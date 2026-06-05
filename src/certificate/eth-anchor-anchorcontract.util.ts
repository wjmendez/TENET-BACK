
import { JsonRpcProvider, Wallet } from 'ethers';

export async function anchorToSepolia({ merkleRoot, privateKey, rpcUrl, dataSinkAddress, waitForConfirmations }: { merkleRoot: string; privateKey: string; rpcUrl: string; dataSinkAddress?: string; waitForConfirmations?: number }) {
  if (!merkleRoot || merkleRoot.length === 0) {
    throw new Error('Merkle root is empty');
  }
  
  // Normalizar merkle root: debe ser 32 bytes (64 hex chars + 0x = 66 chars)
  const rootWithout0x = merkleRoot.startsWith('0x') ? merkleRoot.slice(2) : merkleRoot;
  if (rootWithout0x.length !== 64) {
    throw new Error(`Merkle root must be 32 bytes hex. Got ${rootWithout0x.length / 2} bytes (${rootWithout0x.length} hex chars)`);
  }
  const rootBytes32 = '0x' + rootWithout0x.toLowerCase();
  
  if (!privateKey || privateKey.length === 0) {
    throw new Error('Private key is empty');
  }
  
  if (!rpcUrl || rpcUrl.length === 0) {
    throw new Error('RPC URL is empty');
  }
  
  // Normalizar y validar clave privada
  let normalizedPrivateKey = privateKey.trim();
  
  // Remover 0x si está presente
  if (normalizedPrivateKey.startsWith('0x') || normalizedPrivateKey.startsWith('0X')) {
    normalizedPrivateKey = normalizedPrivateKey.slice(2);
  }
  
  // Validar que sea hexadecimal y tenga la longitud correcta (64 caracteres = 32 bytes)
  if (!/^[0-9a-fA-F]{64}$/.test(normalizedPrivateKey)) {
    throw new Error(
      `Invalid private key format. Expected 64 hex characters (32 bytes). ` +
      `Got ${normalizedPrivateKey.length} characters. ` +
      `Make sure your ETHEREUM_PRIVATE_KEY is a valid hexadecimal string without spaces or special characters.`
    );
  }
  
  // Agregar 0x para ethers
  normalizedPrivateKey = '0x' + normalizedPrivateKey.toLowerCase();
  
  try {
    const provider = new JsonRpcProvider(rpcUrl);
    
    // Verificar conexión
    try {
      const blockNumber = await provider.getBlockNumber();
      console.log(`Connected to blockchain at block ${blockNumber}`);
    } catch (err: any) {
      throw new Error(`Failed to connect to RPC at ${rpcUrl}: ${err?.message || err}`);
    }
    
    // Validar la clave privada intentando crear el wallet
    let wallet: Wallet;
    try {
      wallet = new Wallet(normalizedPrivateKey, provider);
      console.log(`Wallet address: ${wallet.address}`);
    } catch (err: any) {
      if (err.code === 'INVALID_ARGUMENT' && err.argument === 'privateKey') {
        throw new Error(
          `Invalid private key. The private key must be a 64-character hexadecimal string (32 bytes). ` +
          `Please check your ETHEREUM_PRIVATE_KEY in your .env file. ` +
          `Make sure it doesn't have extra spaces, newlines, or invalid characters.`
        );
      }
      throw err;
    }
    const toAddress =
      dataSinkAddress && dataSinkAddress !== ''
        ? dataSinkAddress
        : '0x0000000000000000000000000000000000000000';

    // Verificar balance y estimar costo de gas
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = Number(balance) / 1e18;
    console.log(`Wallet address: ${wallet.address}`);
    console.log(`Wallet balance: ${balance.toString()} wei (${balanceEth.toFixed(6)} ETH)`);
    
    // Obtener precio de gas
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || 0n;
    const gasLimit = 60000n;
    const estimatedCost = gasLimit * gasPrice;
    const estimatedCostEth = Number(estimatedCost) / 1e18;
    
    console.log(`Estimated gas cost: ${estimatedCost.toString()} wei (${estimatedCostEth.toFixed(6)} ETH)`);
    
    if (balance < estimatedCost) {
      throw new Error(
        `Insufficient balance. Wallet has ${balanceEth.toFixed(6)} ETH but needs at least ${estimatedCostEth.toFixed(6)} ETH for gas. ` +
        `Please fund your wallet at address: ${wallet.address}`
      );
    }

    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: 0n,
      data: rootBytes32,
      gasLimit: gasLimit
    });
    
    console.log(`Transaction sent: ${tx.hash}`);
    
    // Para redes locales (Besu), no esperar confirmaciones o esperar solo 1
    // Para redes públicas (Sepolia), esperar confirmaciones por defecto
    const isLocalNetwork = rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1') || rpcUrl.includes('10.10.');
    const confirmations = waitForConfirmations !== undefined 
      ? waitForConfirmations 
      : (isLocalNetwork ? 0 : 1); // 0 confirmaciones para local, 1 para redes públicas
    
    if (confirmations > 0) {
      console.log(`Waiting for ${confirmations} confirmation(s)...`);
      await tx.wait(confirmations);
      console.log(`Transaction confirmed: ${tx.hash}`);
    } else {
      console.log(`Transaction sent (not waiting for confirmations in local network): ${tx.hash}`);
    }
    
    return tx.hash;
  } catch (err: any) {
    if (err?.message) {
      throw new Error(`Transaction failed: ${err.message}`);
    }
    throw err;
  }
}
