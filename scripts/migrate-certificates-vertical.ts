#!/usr/bin/env node
/**
 * Script de migración de datos: Asignar verticalId e issuerDid a certificados existentes
 * 
 * Este script:
 * 1. Asigna verticalId desde template.verticalId
 * 2. Asigna issuerDid desde template.issuer.did
 * 3. Solo actualiza certificados que no tienen estos campos
 * 
 * Ejecutar con: node --loader ts-node/esm scripts/migrate-certificates-vertical.ts
 * o: npx tsx scripts/migrate-certificates-vertical.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCertificates() {
  console.log('🚀 Iniciando migración de certificados...\n');

  try {
    // 1. Asignar verticalId desde template
    console.log('📋 Paso 1: Asignando verticalId desde template...');
    const result1 = await prisma.$executeRaw`
      UPDATE "Certificate" c
      SET "verticalId" = t."verticalId"
      FROM "Template" t
      WHERE c."templateId" = t.id 
        AND t."verticalId" IS NOT NULL 
        AND c."verticalId" IS NULL
    `;
    console.log(`   ✅ ${result1} certificados actualizados con verticalId\n`);

    // 2. Asignar issuerDid desde template.issuer.did
    console.log('📋 Paso 2: Asignando issuerDid desde template.issuer.did...');
    const result2 = await prisma.$executeRaw`
      UPDATE "Certificate" c
      SET "issuerDid" = i.did
      FROM "Template" t
      JOIN "Issuer" i ON t."issuerId" = i.id
      WHERE c."templateId" = t.id 
        AND i.did IS NOT NULL 
        AND c."issuerDid" IS NULL
    `;
    console.log(`   ✅ ${result2} certificados actualizados con issuerDid\n`);

    // 3. Estadísticas finales
    console.log('📊 Estadísticas finales:');
    const stats = await prisma.certificate.groupBy({
      by: ['verticalId'],
      _count: true,
    });
    
    const total = await prisma.certificate.count();
    const withVertical = await prisma.certificate.count({
      where: { verticalId: { not: null } },
    });
    const withIssuerDid = await prisma.certificate.count({
      where: { issuerDid: { not: null } },
    });

    console.log(`   Total de certificados: ${total}`);
    console.log(`   Con verticalId: ${withVertical}`);
    console.log(`   Con issuerDid: ${withIssuerDid}`);
    console.log('\n   Por vertical:');
    for (const stat of stats) {
      const vertical = stat.verticalId
        ? await prisma.vertical.findUnique({
            where: { id: stat.verticalId },
            select: { name: true, slug: true },
          })
        : null;
      const verticalName = vertical ? `${vertical.name} (${vertical.slug})` : 'Sin vertical';
      console.log(`     - ${verticalName}: ${stat._count}`);
    }

    console.log('\n✅ Migración completada exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración
migrateCertificates()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

