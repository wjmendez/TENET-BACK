import { buildMerkleTree, sha256Canonical, verifyProof } from "./merkle.util.js";

describe('Merkle Tree', () => {
  it('debe construir y verificar proof con 3 hojas (duplicación impar)', () => {
    const leaves = ['a', 'b', 'c'].map(x => sha256Canonical({ value: x }));
    const { root, proofs } = buildMerkleTree(leaves);
    // La hoja 'c' debe tener un proof válido
    expect(verifyProof(leaves[2], proofs[leaves[2].toString('hex')], root)).toBe(true);
    // Prueba negativa: hoja no existente
    const fakeLeaf = sha256Canonical({ value: 'd' });
    expect(verifyProof(fakeLeaf, proofs[leaves[2].toString('hex')], root)).toBe(false);
  });

  it('debe construir y verificar proof con 4 hojas', () => {
    const leaves = ['a', 'b', 'c', 'd'].map(x => sha256Canonical({ value: x }));
    const { root, proofs } = buildMerkleTree(leaves);
    expect(verifyProof(leaves[0], proofs[leaves[0].toString('hex')], root)).toBe(true);
    expect(verifyProof(leaves[3], proofs[leaves[3].toString('hex')], root)).toBe(true);
  });
});
