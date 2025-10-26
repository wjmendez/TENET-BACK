import { canonicalize } from 'json-canonicalize';
import * as crypto from 'crypto';

export function sha256Canonical(obj: any): Buffer {
  return crypto.createHash('sha256').update(canonicalize(obj)).digest();
}

export type MerkleProofStep = { position: 'left' | 'right', hash: string };

export function buildMerkleTree(leaves: Buffer[]): {
  root: string,
  proofs: Record<string, MerkleProofStep[]>
} {
  if (leaves.length === 0) throw new Error('No leaves provided');
  let level = leaves.map(b => b);
  const tree: Buffer[][] = [level];
  while (level.length > 1) {
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        nextLevel.push(crypto.createHash('sha256').update(Buffer.concat([level[i], level[i + 1]])).digest());
      } else {
        // Duplicar la última hoja si es impar
        nextLevel.push(crypto.createHash('sha256').update(Buffer.concat([level[i], level[i]])).digest());
      }
    }
    tree.push(nextLevel);
    level = nextLevel;
  }
  // Proofs con dirección
  const proofs: Record<string, MerkleProofStep[]> = {};
  leaves.forEach((leaf, idx) => {
    let proof: MerkleProofStep[] = [];
    let pos = idx;
    for (let l = 0; l < tree.length - 1; l++) {
      const levelLength = tree[l].length;
      let sibling;
      if (pos % 2 === 0) {
        sibling = pos + 1;
        if (sibling >= levelLength) sibling = pos; // Duplicación impar
        proof.push({ position: 'right', hash: tree[l][sibling].toString('hex') });
      } else {
        sibling = pos - 1;
        proof.push({ position: 'left', hash: tree[l][sibling].toString('hex') });
      }
      pos = Math.floor(pos / 2);
    }
    proofs[leaf.toString('hex')] = proof;
  });
  return { root: tree[tree.length - 1][0].toString('hex'), proofs };
}

export function verifyProof(leaf: Buffer, proof: MerkleProofStep[], root: string): boolean {
  let hash = leaf;
  for (const step of proof) {
    const sibling = Buffer.from(step.hash, 'hex');
    if (step.position === 'left') {
      hash = crypto.createHash('sha256').update(Buffer.concat([sibling, hash])).digest();
    } else {
      hash = crypto.createHash('sha256').update(Buffer.concat([hash, sibling])).digest();
    }
  }
  return hash.toString('hex') === root;
}
