/**
 * Prisma Seed - Pobla la base de datos con datos iniciales
 * 
 * Este seed crea:
 * 1. Vertical EdTech (activa)
 * 2. Vertical SportsTech (activa para desarrollo)
 * 3. Otras verticales (inactivas)
 * 4. Tipo de credencial "Diploma" para EdTech
 * 
 * Ejecutar con: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...\n');

  try {
    // 0. Crear planes base
    console.log('📦 Creando planes base...');
    const freeScopes = [
      'api-keys:read',
      'api-keys:write',
      'issuers:read',
      'issuers:write',
      'templates:read',
      'templates:write',
      'credentials:read',
      'credentials:issue',
      'anchors:read',
      'anchors:approve',
      'credential-types:read',
      'verticals:read',
      'bundles:read',
      'nft:read',
      'nft:mint',
      'nft:anchor',
      'nft:issue',
      'smart-medals:read',
    ];

    const trialScopes = [
      ...freeScopes,
      'credentials:revoke',
      'credentials:reinstate',
      'credential-types:write',
      'credential-types:validate',
      'verticals:configure',
      'bundles:write',
      'bundles:anchor',
      'nft:transfer',
      'smart-medals:write',
      'events:ingest',
    ];

    const proScopes = [
      ...trialScopes,
      'verticals:write',
    ];

    const plans = [
      {
        code: 'FREE',
        version: 1,
        isActive: true,
        monthlyIssuanceQuota: 100,
        monthlyApiCallsQuota: 10000,
        rateLimitRps: 5,
        features: { customDomain: false, nftMinting: true, scopes: freeScopes },
      },
      {
        code: 'TRIAL',
        version: 1,
        isActive: true,
        monthlyIssuanceQuota: 1000,
        monthlyApiCallsQuota: 50000,
        rateLimitRps: 10,
        features: { customDomain: false, nftMinting: true, scopes: trialScopes },
      },
      {
        code: 'PRO',
        version: 1,
        isActive: true,
        monthlyIssuanceQuota: 10000,
        monthlyApiCallsQuota: 500000,
        rateLimitRps: 25,
        features: { customDomain: true, nftMinting: true, scopes: proScopes },
      },
    ];

    for (const plan of plans) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        create: plan,
        update: {
          version: plan.version,
          isActive: plan.isActive,
          monthlyIssuanceQuota: plan.monthlyIssuanceQuota,
          monthlyApiCallsQuota: plan.monthlyApiCallsQuota,
          rateLimitRps: plan.rateLimitRps,
          features: plan.features,
        },
      });
    }
    console.log('✅ Planes base listos');

    // 0.1 Crear tenant default (para datos existentes)
    console.log('🏢 Creando tenant default...');
    const defaultTenant = await prisma.tenant.upsert({
      where: { slug: 'default' },
      create: {
        name: 'Default Tenant',
        slug: 'default',
        status: 'ACTIVE',
        branding: {
          create: {
            subdomain: 'default',
            domainStatus: 'PENDING',
          },
        },
      },
      update: {},
    });

    const defaultPlan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
    if (defaultPlan) {
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await prisma.tenantPlan.upsert({
        where: {
          tenantId_planId: {
            tenantId: defaultTenant.id,
            planId: defaultPlan.id,
          },
        },
        create: {
          tenantId: defaultTenant.id,
          planId: defaultPlan.id,
          periodStart,
          periodEnd,
          status: 'ACTIVE',
        },
        update: {},
      });
    }

    const defaultTenantId = defaultTenant.id;

    // 0.15 Crear usuario superadmin por defecto
    const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@certiflow.local').toLowerCase();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!';
    const adminName = process.env.DEFAULT_ADMIN_NAME || 'Super Admin';

    let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash: hashPassword(adminPassword),
        },
      });
      console.log(`✅ Usuario admin creado: ${adminEmail}`);
    } else if (!adminUser.passwordHash) {
      adminUser = await prisma.user.update({
        where: { id: adminUser.id },
        data: { passwordHash: hashPassword(adminPassword) },
      });
      console.log(`✅ Password admin seteado: ${adminEmail}`);
    }

    await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: defaultTenantId,
          userId: adminUser.id,
        },
      },
      create: {
        tenantId: defaultTenantId,
        userId: adminUser.id,
        role: 'OWNER',
      },
      update: {},
    });

    // 0. Crear catalogo de redes
    console.log('🌐 Creando catalogo de redes...');
    const chainNetworks = [
      {
        slug: 'eth-mainnet',
        displayName: 'Ethereum Mainnet',
        veramoPlugin: 'did:ethr',
        chainId: '1',
        rpcUrl: null,
        isActive: true,
      },
      {
        slug: 'eth-sepolia',
        displayName: 'Ethereum Sepolia',
        veramoPlugin: 'did:ethr',
        chainId: '11155111',
        rpcUrl: null,
        isActive: true,
      },
      {
        slug: 'polygon',
        displayName: 'Polygon PoS',
        veramoPlugin: 'did:polygon',
        chainId: '137',
        rpcUrl: null,
        isActive: true,
      },
      {
        slug: 'polygon-mumbai',
        displayName: 'Polygon Mumbai',
        veramoPlugin: 'did:polygon',
        chainId: '80001',
        rpcUrl: null,
        isActive: true,
      },
      {
        slug: 'lacchain',
        displayName: 'LACChain',
        veramoPlugin: 'did:ethr',
        chainId: null,
        rpcUrl: null,
        isActive: true,
      },
      {
        slug: 'besu',
        displayName: 'Hyperledger Besu',
        veramoPlugin: 'did:ethr',
        chainId: null,
        rpcUrl: null,
        isActive: true,
      },
    ];

    for (const network of chainNetworks) {
      await prisma.chainNetwork.upsert({
        where: { slug: network.slug },
        create: network,
        update: {
          displayName: network.displayName,
          veramoPlugin: network.veramoPlugin,
          chainId: network.chainId,
          rpcUrl: network.rpcUrl,
          isActive: network.isActive,
        },
      });
    }
    console.log('✅ Catalogo de redes listo');

    // 1. Crear vertical EdTech
    console.log('📦 Creando vertical EdTech...');
    let edtechVertical = await prisma.vertical.findFirst({
      where: { slug: 'edtech', tenantId: defaultTenantId },
    });

    if (!edtechVertical) {
      edtechVertical = await prisma.vertical.create({
        data: {
          tenantId: defaultTenantId,
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

    // 2. Crear tipo de credencial "Diploma" para EdTech
    console.log('\n📜 Creando tipo de credencial "Diploma"...');
    let diplomaType = await prisma.credentialType.findFirst({
      where: {
        tenantId: defaultTenantId,
        verticalId: edtechVertical.id,
        name: 'Diploma',
      },
    });

    if (!diplomaType) {
      diplomaType = await prisma.credentialType.create({
        data: {
          tenantId: defaultTenantId,
          verticalId: edtechVertical.id,
          name: 'Diploma',
          type: 'VC_STATIC',
          schema: null,
          displayConfig: null,
          updatePolicy: null,
          isActive: true,
        },
      });
      console.log(`✅ Tipo de credencial "Diploma" creado: ${diplomaType.id}`);
    } else {
      console.log(`ℹ️  Tipo de credencial "Diploma" ya existe: ${diplomaType.id}`);
    }

    // 3. Crear vertical SportsTech (activa para desarrollo)
    console.log('\n🏆 Creando vertical SportsTech...');
    let sportstechVertical = await prisma.vertical.findFirst({
      where: { slug: 'sportstech', tenantId: defaultTenantId },
    });

    if (!sportstechVertical) {
      sportstechVertical = await prisma.vertical.create({
        data: {
          tenantId: defaultTenantId,
          name: 'SportsTech',
          slug: 'sportstech',
          description: 'Deportes - Medallas y logros deportivos',
          config: {
            blockchain: 'besu',
            privacyLevel: 'public',
            didMethod: 'did:web',
            features: ['nft', 'smart-medal', 'dynamic', 'metadata_updates'],
          },
          isActive: true, // Activa para desarrollo
        },
      });
      console.log(`✅ Vertical SportsTech creada: ${sportstechVertical.id}`);
    } else {
      console.log(`ℹ️  Vertical SportsTech ya existe: ${sportstechVertical.id}`);
    }

    // 4. Crear otras verticales (inactivas)
    console.log('\n🔮 Creando otras verticales (inactivas)...');

    const futureVerticals = [
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
      const existing = await prisma.vertical.findFirst({
        where: { slug: verticalData.slug, tenantId: defaultTenantId },
      });

      if (!existing) {
        await prisma.vertical.create({
          data: {
            tenantId: defaultTenantId,
            ...verticalData,
            isActive: false, // Inactiva hasta implementación
          },
        });
        console.log(`✅ Vertical "${verticalData.name}" creada (inactiva)`);
      } else {
        console.log(`ℹ️  Vertical "${verticalData.name}" ya existe`);
      }
    }

    // 5. Resumen
    console.log('\n📊 Resumen del seed:');
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
      orderBy: {
        createdAt: 'asc',
      },
    });

    for (const v of verticals) {
      console.log(`\n  ${v.name} (${v.slug}):`);
      console.log(`    - Activa: ${v.isActive ? '✅' : '❌'}`);
      console.log(`    - Issuers: ${v._count.issuers}`);
      console.log(`    - Templates: ${v._count.templates}`);
      console.log(`    - Tipos de credencial: ${v._count.credentialTypes}`);
    }

    console.log('\n✅ Seed completado exitosamente!');
  } catch (error) {
    console.error('\n❌ Error durante el seed:', error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });





