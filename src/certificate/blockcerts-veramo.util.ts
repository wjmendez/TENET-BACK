import { VeramoService } from '../veramo/veramo.service.js';

/**
 * Utilidades para generar Blockcerts usando Veramo como motor de firma
 * 
 * Estrategia híbrida:
 * 1. Veramo firma el credential criptográficamente (proof de Veramo)
 * 2. El MerkleProof2019 se agrega después del anclaje (proof de Blockcerts)
 * 3. Ambos proofs coexisten en el credential final
 */

/**
 * Firma un Blockcert usando Veramo
 * 
 * @param blockcert Blockcert sin firma (generado por generateBlockcertFromTemplate)
 * @param issuerDid DID del issuer que firma
 * @param veramoService Instancia de VeramoService
 * @returns Blockcert firmado con proof de Veramo (aún sin MerkleProof2019)
 */
export async function signBlockcertWithVeramo(
  blockcert: any,
  issuerDid: string,
  veramoService: VeramoService
): Promise<any> {
  // Veramo requiere que el issuer sea un objeto con id
  const issuerId = typeof blockcert.issuer === 'string' 
    ? blockcert.issuer 
    : blockcert.issuer?.id || issuerDid;

  // Preparar el credential para Veramo
  // Veramo espera un formato específico de Verifiable Credential
  const credentialForVeramo = {
    '@context': blockcert['@context'],
    type: Array.isArray(blockcert.type) ? blockcert.type : [blockcert.type],
    id: blockcert.id,
    issuer: { id: issuerId },
    issuanceDate: blockcert.issuanceDate,
    credentialSubject: blockcert.credentialSubject,
    // Mantener campos específicos de Blockcerts
    ...(blockcert.metadata && { metadata: blockcert.metadata }),
    ...(blockcert.display && { display: blockcert.display }),
    ...(blockcert.displayHtml && { displayHtml: blockcert.displayHtml }),
  };

  // Firmar con Veramo (agrega proof de Veramo automáticamente)
  const signedCredential = await veramoService.signCredential(
    credentialForVeramo,
    issuerDid
  );

  // El proof de Veramo se agrega automáticamente
  // Ahora necesitamos combinar el proof de Veramo con la estructura Blockcerts original
  
  // Si el blockcert original tenía un proof placeholder, lo preservamos como referencia
  // pero el proof activo será el de Veramo hasta que se agregue el MerkleProof2019
  const signedBlockcert = {
    ...signedCredential,
    // Preservar campos Blockcerts que Veramo no maneja
    ...(blockcert.display && { display: blockcert.display }),
    ...(blockcert.displayHtml && { displayHtml: blockcert.displayHtml }),
    ...(blockcert.metadata && { metadata: blockcert.metadata }),
  };

  // IMPORTANTE: El proof de Veramo es el proof principal ahora
  // El MerkleProof2019 se agregará después del anclaje como segundo proof
  // (o reemplazará el proof de Veramo según la estrategia que elijamos)
  
  return signedBlockcert;
}

/**
 * Agrega el MerkleProof2019 a un Blockcert ya firmado con Veramo
 * 
 * Estrategia: Mantener ambos proofs en un array
 * 
 * @param signedBlockcert Blockcert firmado con Veramo
 * @param merkleProof2019 Proof de MerkleProof2019 generado después del anclaje
 * @returns Blockcert con ambos proofs (Veramo + MerkleProof2019)
 */
export function addMerkleProof2019ToSignedBlockcert(
  signedBlockcert: any,
  merkleProof2019: any
): any {
  // Estrategia: Convertir proof en array de proofs
  // El verificador de Blockcerts espera un proof de tipo MerkleProof2019
  // Pero podemos mantener ambos para compatibilidad
  
  // Opción 1: Reemplazar el proof de Veramo con MerkleProof2019 (compatibilidad Blockcerts)
  // Esta es la opción más compatible con verificadores Blockcerts existentes
  const blockcertWithMerkleProof = {
    ...signedBlockcert,
    proof: merkleProof2019, // Reemplazar con MerkleProof2019
  };

  // Opción 2: Mantener ambos proofs (futuro - cuando los verificadores soporten múltiples proofs)
  // const blockcertWithBothProofs = {
  //   ...signedBlockcert,
  //   proof: [signedBlockcert.proof, merkleProof2019], // Array de proofs
  // };

  return blockcertWithMerkleProof;
}

/**
 * Verifica que un Blockcert tenga la estructura correcta para Veramo
 * 
 * @param blockcert Blockcert a verificar
 * @returns true si es válido, false en caso contrario
 */
export function validateBlockcertForVeramo(blockcert: any): boolean {
  if (!blockcert) return false;
  if (!blockcert['@context']) return false;
  if (!blockcert.type) return false;
  if (!blockcert.issuer) return false;
  if (!blockcert.issuanceDate) return false;
  if (!blockcert.credentialSubject) return false;
  
  return true;
}

