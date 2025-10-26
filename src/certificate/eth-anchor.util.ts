import { JsonRpcProvider, Wallet } from 'ethers';
// For ethers v5, use: import { JsonRpcProvider } from '@ethersproject/providers';

export async function anchorToSepolia({ merkleRoot, privateKey, infuraApiKey }) {
  if (!merkleRoot || merkleRoot.length === 0) {
    throw new Error('Merkle root is empty');
  }
  // Si el Merkle root ya es un hash hexadecimal, úsalo directamente
  const dataHex = merkleRoot.startsWith('0x') ? merkleRoot : '0x' + merkleRoot;
  if (dataHex === '0x') {
    throw new Error('Merkle root hex is empty');
  }
  // Conexión a Sepolia
  const provider = new JsonRpcProvider(`https://sepolia.infura.io/v3/${infuraApiKey}`);
  const wallet = new Wallet(privateKey, provider);

  // Enviar transacción con el merkleRoot en los datos
  const tx = await wallet.sendTransaction({
    to: wallet.address, // self-send, solo para anclar el dato
    value: 0,
    data: dataHex,
    gasLimit: 21000 + 10000 // un poco más por el dato
  });
  await tx.wait();
  return tx.hash;
}
