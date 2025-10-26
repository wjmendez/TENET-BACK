
import { JsonRpcProvider, Wallet } from 'ethers';

export async function anchorToSepolia({ merkleRoot, privateKey, rpcUrl, dataSinkAddress }: { merkleRoot: string; privateKey: string; rpcUrl: string; dataSinkAddress?: string }) {
  if (!merkleRoot || merkleRoot.length === 0) {
    throw new Error('Merkle root is empty');
  }
  const rootBytes32 = merkleRoot.startsWith('0x') ? merkleRoot : '0x' + merkleRoot;
  if (rootBytes32.length !== 66) {
    throw new Error('Merkle root must be 32 bytes hex (0x...)');
  }
  const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(normalizedPrivateKey, provider);
  const toAddress =
    dataSinkAddress && dataSinkAddress !== ''
      ? dataSinkAddress
      : '0x0000000000000000000000000000000000000000';

  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: 0n,
    data: rootBytes32,
    gasLimit: 60000n
  });
  await tx.wait();
  return tx.hash;
}
