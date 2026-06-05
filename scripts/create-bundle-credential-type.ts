/**
 * Script: Crear tipo de credencial "Bundle" para EdTech
 * 
 * Este script crea el tipo de credencial "Carpeta de Egreso" (BUNDLE)
 * para la vertical EdTech.
 * 
 * Ejecutar con: npx tsx scripts/create-bundle-credential-type.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBundleCredentialType() {
  console.log('🚀 Creando tipo de credencial Bundle para EdTech...\n');

  try {
    // 1. Obtener vertical EdTech
    const edtech = await prisma.vertical.findUnique({
      where: { slug: 'edtech' },
    });

    if (!edtech) {
      throw new Error('Vertical EdTech no encontrada. Ejecuta primero el script de migración.');
    }

    console.log(`✅ Vertical EdTech encontrada: ${edtech.id}`);

    // 2. Verificar si ya existe el tipo Bundle
    const existingBundle = await prisma.credentialType.findFirst({
      where: {
        verticalId: edtech.id,
        name: 'Carpeta de Egreso',
        type: 'BUNDLE',
      },
    });

    if (existingBundle) {
      console.log(`ℹ️  Tipo de credencial "Carpeta de Egreso" ya existe: ${existingBundle.id}`);
      return existingBundle;
    }

    // 3. Crear tipo de credencial Bundle
    const bundleType = await prisma.credentialType.create({
      data: {
        verticalId: edtech.id,
        name: 'Carpeta de Egreso',
        type: 'BUNDLE',
        schema: {
          type: 'object',
          properties: {
            diploma: {
              type: 'object',
              description: 'Diploma académico',
            },
            analitico: {
              type: 'object',
              description: 'Analítico de notas',
            },
            cartaRecomendacion: {
              type: 'object',
              description: 'Carta de recomendación (opcional)',
            },
          },
          required: ['diploma', 'analitico'],
        },
        displayConfig: {
          bundle: true,
          exportFormats: ['zip', 'json'],
        },
        updatePolicy: null, // Los bundles son estáticos
        isActive: true,
      },
    });

    console.log(`✅ Tipo de credencial "Carpeta de Egreso" creado: ${bundleType.id}`);
    console.log('\n📊 Resumen:');
    console.log(`  - ID: ${bundleType.id}`);
    console.log(`  - Nombre: ${bundleType.name}`);
    console.log(`  - Tipo: ${bundleType.type}`);
    console.log(`  - Vertical: ${edtech.name}`);
    console.log(`  - Activo: ${bundleType.isActive ? '✅' : '❌'}`);

    return bundleType;
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
createBundleCredentialType()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

