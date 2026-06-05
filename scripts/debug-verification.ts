/**
 * Script de depuración para verificar el verificationMethod
 * 
 * Este script ayuda a diagnosticar problemas de verificación comparando:
 * - El verificationMethod del certificado
 * - El verificationMethod del Issuer Profile
 * - El issuer.id del certificado vs el id del Issuer Profile
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugVerification(certificateId: string) {
  console.log(`\n=== Depuración de Verificación para Certificado: ${certificateId} ===\n`);
  
  // Obtener el certificado
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { vertical: true }
  });
  
  if (!certificate) {
    console.error(`Certificado ${certificateId} no encontrado`);
    return;
  }
  
  const blockcert = certificate.data as any;
  const merkleProof = certificate.merkleProof as any;
  
  console.log('1. Información del Certificado:');
  console.log(`   - issuerDid: ${certificate.issuerDid || 'NO DEFINIDO'}`);
  console.log(`   - issuer.id (en blockcert): ${typeof blockcert.issuer === 'string' ? blockcert.issuer : blockcert.issuer?.id || 'NO DEFINIDO'}`);
  console.log(`   - verificationMethod (en merkleProof): ${merkleProof?.verificationMethod || 'NO DEFINIDO'}`);
  console.log(`   - verificationMethod (en blockcert.proof): ${Array.isArray(blockcert.proof) ? blockcert.proof[0]?.verificationMethod : blockcert.proof?.verificationMethod || 'NO DEFINIDO'}`);
  
  // Obtener el DID del issuer
  let issuerDid: string | null = certificate.issuerDid || null;
  if (!issuerDid && blockcert.issuer) {
    if (typeof blockcert.issuer === 'string') {
      issuerDid = blockcert.issuer;
    } else if (blockcert.issuer.id) {
      issuerDid = blockcert.issuer.id;
    }
  }
  
  if (!issuerDid) {
    console.error('\n❌ ERROR: No se pudo determinar el DID del issuer');
    return;
  }
  
  console.log(`\n2. DID del Issuer: ${issuerDid}`);
  
  // Construir el verificationMethod esperado
  const expectedVerificationMethod = `${issuerDid}#key-1`;
  console.log(`   - verificationMethod esperado: ${expectedVerificationMethod}`);
  
  // Obtener el Issuer Profile
  console.log(`\n3. Obteniendo Issuer Profile...`);
  try {
    const issuerId = issuerDid.split(':').pop();
    const issuerProfileUrl = `http://localhost:3100/issuers/${issuerId}/issuer.json`;
    console.log(`   - URL: ${issuerProfileUrl}`);
    
    const response = await fetch(issuerProfileUrl);
    if (!response.ok) {
      console.error(`   ❌ ERROR: No se pudo obtener el Issuer Profile (${response.status})`);
      return;
    }
    
    const issuerProfile = await response.json();
    
    console.log(`\n4. Información del Issuer Profile:`);
    console.log(`   - id: ${issuerProfile.id}`);
    console.log(`   - verificationMethod[0].id: ${issuerProfile.verificationMethod?.[0]?.id || 'NO DEFINIDO'}`);
    console.log(`   - verificationMethod[0].controller: ${issuerProfile.verificationMethod?.[0]?.controller || 'NO DEFINIDO'}`);
    console.log(`   - assertionMethod: ${JSON.stringify(issuerProfile.assertionMethod || [])}`);
    
    // Verificar coincidencias
    console.log(`\n5. Verificación de Coincidencias:`);
    
    const issuerIdMatches = issuerProfile.id === issuerDid;
    console.log(`   - issuer.id del certificado coincide con id del Issuer Profile: ${issuerIdMatches ? '✅' : '❌'}`);
    console.log(`     Certificado: ${issuerDid}`);
    console.log(`     Issuer Profile: ${issuerProfile.id}`);
    
    const verificationMethodMatches = expectedVerificationMethod === issuerProfile.verificationMethod?.[0]?.id;
    console.log(`   - verificationMethod coincide: ${verificationMethodMatches ? '✅' : '❌'}`);
    console.log(`     Certificado: ${expectedVerificationMethod}`);
    console.log(`     Issuer Profile: ${issuerProfile.verificationMethod?.[0]?.id}`);
    
    const controllerMatches = issuerProfile.verificationMethod?.[0]?.controller === issuerProfile.id;
    console.log(`   - controller coincide con id del Issuer Profile: ${controllerMatches ? '✅' : '❌'}`);
    console.log(`     Controller: ${issuerProfile.verificationMethod?.[0]?.controller}`);
    console.log(`     Issuer Profile ID: ${issuerProfile.id}`);
    
    const assertionMethodIncludes = issuerProfile.assertionMethod?.includes(expectedVerificationMethod);
    console.log(`   - assertionMethod incluye verificationMethod del certificado: ${assertionMethodIncludes ? '✅' : '❌'}`);
    console.log(`     assertionMethod: ${JSON.stringify(issuerProfile.assertionMethod)}`);
    console.log(`     verificationMethod del certificado: ${expectedVerificationMethod}`);
    
    if (issuerIdMatches && verificationMethodMatches && controllerMatches && assertionMethodIncludes) {
      console.log(`\n✅ TODO COINCIDE CORRECTAMENTE`);
    } else {
      console.log(`\n❌ HAY DISCREPANCIAS - Revisar los valores arriba`);
    }
    
  } catch (error: any) {
    console.error(`   ❌ ERROR al obtener Issuer Profile: ${error.message}`);
  }
  
  await prisma.$disconnect();
}

// Ejecutar si se proporciona un ID de certificado
const certificateId = process.argv[2];
if (!certificateId) {
  console.error('Uso: npx ts-node scripts/debug-verification.ts <certificateId>');
  process.exit(1);
}

debugVerification(certificateId).catch(console.error);







