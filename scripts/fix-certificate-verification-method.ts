/**
 * Script para actualizar el verificationMethod en el merkleProof almacenado
 * 
 * Este script actualiza el verificationMethod en el merkleProof de un certificado
 * para que coincida con el formato correcto del Issuer Profile.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixCertificateVerificationMethod(certificateId: string) {
  console.log(`\n=== Actualizando verificationMethod para Certificado: ${certificateId} ===\n`);
  
  // Obtener el certificado
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { vertical: true }
  });
  
  if (!certificate) {
    console.error(`Certificado ${certificateId} no encontrado`);
    return;
  }
  
  if (!certificate.merkleProof) {
    console.error(`Certificado ${certificateId} no tiene merkleProof (no está anclado)`);
    return;
  }
  
  // Obtener el DID del issuer
  let issuerDid: string | null = certificate.issuerDid || null;
  const blockcert = certificate.data as any;
  
  if (!issuerDid && blockcert.issuer) {
    if (typeof blockcert.issuer === 'string') {
      issuerDid = blockcert.issuer;
    } else if (blockcert.issuer.id) {
      issuerDid = blockcert.issuer.id;
    }
  }
  
  if (!issuerDid) {
    console.error('No se pudo determinar el DID del issuer');
    return;
  }
  
  // Construir el verificationMethod correcto
  const correctVerificationMethod = `${issuerDid}#key-1`;
  
  console.log(`DID del Issuer: ${issuerDid}`);
  console.log(`verificationMethod correcto: ${correctVerificationMethod}`);
  
  // Obtener el merkleProof actual
  const merkleProof = certificate.merkleProof as any;
  const currentVerificationMethod = merkleProof.verificationMethod;
  
  console.log(`verificationMethod actual: ${currentVerificationMethod}`);
  
  if (currentVerificationMethod === correctVerificationMethod) {
    console.log('\n✅ El verificationMethod ya es correcto, no se necesita actualizar');
    return;
  }
  
  // Actualizar el merkleProof
  const updatedMerkleProof = {
    ...merkleProof,
    verificationMethod: correctVerificationMethod,
  };
  
  // Actualizar en la base de datos
  await prisma.certificate.update({
    where: { id: certificateId },
    data: {
      merkleProof: updatedMerkleProof,
    },
  });
  
  console.log('\n✅ verificationMethod actualizado correctamente');
  console.log(`   Antes: ${currentVerificationMethod}`);
  console.log(`   Ahora: ${correctVerificationMethod}`);
  
  await prisma.$disconnect();
}

// Ejecutar si se proporciona un ID de certificado
const certificateId = process.argv[2];
if (!certificateId) {
  console.error('Uso: npx ts-node scripts/fix-certificate-verification-method.ts <certificateId>');
  process.exit(1);
}

fixCertificateVerificationMethod(certificateId).catch(console.error);







