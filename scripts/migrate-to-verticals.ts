/**
 * Script de migración: Migrar datos existentes a sistema de verticales
 * 
 * Este script:
 * 1. Crea la vertical "EdTech" para datos existentes
 * 2. Crea el tipo de credencial "Diploma" (VC_STATIC)
 * 3. Migra issuers existentes a EdTech
 * 4. Migra templates existentes a EdTech
 * 
 * Ejecutar con: npx tsx scripts/migrate-to-verticals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToVerticals() {
  console.log('🚀 Iniciando migración a sistema de verticales...\n');

  try {
    // 1. Crear vertical EdTech
    console.log('📦 Creando vertical EdTech...');
    let edtechVertical = await prisma.vertical.findUnique({
      where: { slug: 'edtech' },
    });

    if (!edtechVertical) {
      edtechVertical = await prisma.vertical.create({
        data: {
          name: 'EdTech',
          slug: 'edtech',
          description: 'Educación - Certificados académicos y diplomas',
          config: {
            blockchain: 'besu',
            privacyLevel: 'public',
            didMethod: 'did:web',
            features: ['bundle', 'open_badges'],
          },
          isActive: true,
        },
      });
      console.log(`✅ Vertical EdTech creada: ${edtechVertical.id}`);
    } else {
      console.log(`ℹ️  Vertical EdTech ya existe: ${edtechVertical.id}`);
    }

    // 2. Crear tipo de credencial "Diploma"
    console.log('\n📜 Creando tipo de credencial "Diploma"...');
    let diplomaType = await prisma.credentialType.findFirst({
      where: {
        verticalId: edtechVertical.id,
        name: 'Diploma',
      },
    });

    if (!diplomaType) {
      diplomaType = await prisma.credentialType.create({
        data: {
          verticalId: edtechVertical.id,
          name: 'Diploma',
          type: 'VC_STATIC',
          schema: null, // Se puede agregar después
          displayConfig: null,
          updatePolicy: null,
          isActive: true,
        },
      });
      console.log(`✅ Tipo de credencial "Diploma" creado: ${diplomaType.id}`);
    } else {
      console.log(`ℹ️  Tipo de credencial "Diploma" ya existe: ${diplomaType.id}`);
    }

    // 3. Migrar issuers existentes a EdTech
    console.log('\n👤 Migrando issuers existentes a EdTech...');
    const issuersWithoutVertical = await prisma.issuer.findMany({
      where: { verticalId: null },
    });

    if (issuersWithoutVertical.length > 0) {
      const result = await prisma.issuer.updateMany({
        where: { verticalId: null },
        data: { verticalId: edtechVertical.id },
      });
      console.log(`✅ ${result.count} issuers migrados a EdTech`);
    } else {
      console.log('ℹ️  No hay issuers sin vertical para migrar');
    }

    // 4. Migrar templates existentes a EdTech
    console.log('\n📋 Migrando templates existentes a EdTech...');
    const templatesWithoutVertical = await prisma.template.findMany({
      where: { verticalId: null },
    });

    if (templatesWithoutVertical.length > 0) {
      const result = await prisma.template.updateMany({
        where: { verticalId: null },
        data: {
          verticalId: edtechVertical.id,
          credentialTypeId: diplomaType.id,
        },
      });
      console.log(`✅ ${result.count} templates migrados a EdTech`);
    } else {
      console.log('ℹ️  No hay templates sin vertical para migrar');
    }

    // 5. Crear verticales futuras (inactivas)
    console.log('\n🔮 Creando verticales futuras (inactivas)...');

    const futureVerticals = [
      {
        name: 'SportsTech',
        slug: 'sportstech',
        description: 'Deportes - Medallas y logros deportivos',
        config: {
          blockchain: 'besu',
          privacyLevel: 'public',
          didMethod: 'did:web',
          features: ['nft', 'dynamic', 'metadata_updates'],
        },
      },
      {
        name: 'HealthTech',
        slug: 'healthtech',
        description: 'Salud - Credenciales médicas y recetas',
        config: {
          blockchain: 'lacchain',
          privacyLevel: 'private',
          didMethod: 'did:lacchain',
          features: ['privacy', 'selective_disclosure'],
        },
      },
      {
        name: 'HR Tech',
        slug: 'hrtech',
        description: 'RRHH - Certificados de empleo',
        config: {
          blockchain: 'besu',
          privacyLevel: 'public',
          didMethod: 'did:web',
          features: [],
        },
      },
      {
        name: 'Retail',
        slug: 'retail',
        description: 'Consumo - Garantías digitales',
        config: {
          blockchain: 'besu',
          privacyLevel: 'public',
          didMethod: 'did:web',
          features: ['nft', 'transferable'],
        },
      },
    ];

    for (const verticalData of futureVerticals) {
      const existing = await prisma.vertical.findUnique({
        where: { slug: verticalData.slug },
      });

      if (!existing) {
        await prisma.vertical.create({
          data: {
            ...verticalData,
            isActive: false, // Inactiva hasta implementación
          },
        });
        console.log(`✅ Vertical "${verticalData.name}" creada (inactiva)`);
      } else {
        console.log(`ℹ️  Vertical "${verticalData.name}" ya existe`);
      }
    }

    // 6. Resumen
    console.log('\n📊 Resumen de migración:');
    const verticals = await prisma.vertical.findMany({
      include: {
        _count: {
          select: {
            issuers: true,
            templates: true,
            credentialTypes: true,
          },
        },
      },
    });

    for (const v of verticals) {
      console.log(`\n  ${v.name} (${v.slug}):`);
      console.log(`    - Activa: ${v.isActive ? '✅' : '❌'}`);
      console.log(`    - Issuers: ${v._count.issuers}`);
      console.log(`    - Templates: ${v._count.templates}`);
      console.log(`    - Tipos de credencial: ${v._count.credentialTypes}`);
    }

    console.log('\n✅ Migración completada exitosamente!');
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar migración
migrateToVerticals()
  .then(() => {
    console.log('\n🎉 Proceso finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error fatal:', error);
    process.exit(1);
  });

