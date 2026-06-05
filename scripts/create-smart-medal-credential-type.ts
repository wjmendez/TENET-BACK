/**
 * Script: Crear tipo de credencial "Smart Medal" para SportsTech
 * 
 * Este script crea el tipo de credencial "Smart Medal" (NFT_DYNAMIC)
 * para la vertical SportsTech.
 * 
 * Ejecutar con: npx tsx scripts/create-smart-medal-credential-type.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createSmartMedalCredentialType() {
  console.log('🚀 Creando tipo de credencial Smart Medal para SportsTech...\n');

  try {
    // 1. Obtener vertical SportsTech
    const sportstech = await prisma.vertical.findUnique({
      where: { slug: 'sportstech' },
    });

    if (!sportstech) {
      throw new Error('Vertical SportsTech no encontrada. Debe existir desde la migración inicial.');
    }

    console.log(`✅ Vertical SportsTech encontrada: ${sportstech.id}`);

    // 2. Verificar si ya existe el tipo Smart Medal
    const existing = await prisma.credentialType.findFirst({
      where: {
        verticalId: sportstech.id,
        name: 'Smart Medal',
        type: 'NFT_DYNAMIC',
      },
    });

    if (existing) {
      console.log(`ℹ️  Tipo de credencial "Smart Medal" ya existe: ${existing.id}`);
      return existing;
    }

    // 3. Crear tipo de credencial Smart Medal
    const smartMedalType = await prisma.credentialType.create({
      data: {
        verticalId: sportstech.id,
        name: 'Smart Medal',
        type: 'NFT_DYNAMIC',
        schema: {
          type: 'object',
          properties: {
            eventName: { type: 'string' },
            participantName: { type: 'string' },
            participantEmail: { type: 'string' },
            eventId: { type: 'string' },
            participantId: { type: 'string' },
            finishTime: { type: ['string', 'number', 'null'] },
            medalType: {
              type: 'string',
              enum: ['GOLD', 'SILVER', 'BRONZE', 'PARTICIPANT'],
            },
            thresholds: {
              type: 'object',
              properties: {
                gold: { type: 'number' },
                silver: { type: 'number' },
                bronze: { type: 'number' },
              },
            },
          },
          required: ['eventName', 'participantName', 'participantEmail', 'eventId', 'participantId'],
        },
        displayConfig: {
          dynamic: true,
          templates: {
            GOLD: {
              image: 'medal-gold.svg',
              animation: 'sparkle',
              color: '#FFD700',
            },
            SILVER: {
              image: 'medal-silver.svg',
              animation: 'glow',
              color: '#C0C0C0',
            },
            BRONZE: {
              image: 'medal-bronze.svg',
              animation: 'pulse',
              color: '#CD7F32',
            },
            PARTICIPANT: {
              image: 'medal-participant.svg',
              color: '#808080',
            },
          },
        },
        updatePolicy: {
          type: 'TIME_BASED',
          trigger: {
            source: 'external',
            endpoint: '${TIMING_API_URL}/results/${eventId}/${participantId}',
            pollInterval: 30000,
          },
          updateLogic: {
            rules: [
              {
                condition: 'external.finishTime < thresholds.gold',
                action: {
                  medalType: 'GOLD',
                  metadata: { color: '#FFD700', tier: 1 },
                },
              },
              {
                condition: 'external.finishTime < thresholds.silver',
                action: {
                  medalType: 'SILVER',
                  metadata: { color: '#C0C0C0', tier: 2 },
                },
              },
              {
                condition: 'external.finishTime < thresholds.bronze',
                action: {
                  medalType: 'BRONZE',
                  metadata: { color: '#CD7F32', tier: 3 },
                },
              },
            ],
          },
        },
        isActive: true,
      },
    });

    console.log(`✅ Tipo de credencial "Smart Medal" creado: ${smartMedalType.id}`);
    console.log('\n📊 Resumen:');
    console.log(`  - ID: ${smartMedalType.id}`);
    console.log(`  - Nombre: ${smartMedalType.name}`);
    console.log(`  - Tipo: ${smartMedalType.type}`);
    console.log(`  - Vertical: ${sportstech.name}`);
    console.log(`  - Activo: ${smartMedalType.isActive ? '✅' : '❌'}`);

    return smartMedalType;
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
createSmartMedalCredentialType()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

