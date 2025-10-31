import { v4 as uuidv4 } from 'uuid';

export function generateBlockcert({ recipientName, recipientEmail, course, date, issuerName, issuerId, issuerPublicKey, appUrl }) {
  const issuanceDate = new Date(date).toISOString();
  const baseUrl = process.env.APP_URL ;
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://w3id.org/blockcerts/v3.1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
      {
        'issuanceDate': 'http://www.w3.org/2001/XMLSchema#dateTime',
        'RevocationList': 'https://w3id.org/blockcerts#RevocationList',
        'courseName': 'https://schema.org/name'
      }
    ],
    id: `urn:uuid:${uuidv4()}`,
    type: ['VerifiableCredential', 'BlockcertsCredential'],
    issuer: {
      id: `${baseUrl}/issuer.json`,
      name: issuerName,
    },
    issuanceDate: issuanceDate,
    credentialSubject: {
      id: `mailto:${recipientEmail}`,
      name: recipientName,
      courseName: course
    },
    proof: {
      type: 'MerkleProof2019',
      created: issuanceDate,
      proofPurpose: 'assertionMethod',
      verificationMethod: `${baseUrl}/issuer.json#key-1`,
      merkleRoot: '', // Se completa tras el anclaje
      targetHash: '', // Se completa tras el anclaje
      proofValue: '', // Se completa tras el anclaje
      anchors: [] // Se completa tras el anclaje
    }
  };
}
