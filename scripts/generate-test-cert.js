import { PrismaClient } from '@prisma/client';
import { generateBlockcert } from '../src/certificate/blockcerts.util.js';
import { anchorToSepolia } from '../src/certificate/eth-anchor-anchorcontract.util.js';
import * as crypto from 'crypto';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Encoder } from '@vaultie/lds-merkle-proof-2019';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// Utility functions from anchor service
function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function strip0x(h) {
  return (h || '').toLowerCase().replace(/^0x/, '');
}

function ensure0x(h) {
  const v = h.toLowerCase();
  return v.startsWith('0x') ? v : `0x${v}`;
}

// Load contexts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getBlockcertsContext() {
  const distPath = path.join(__dirname, '../contexts/blockcerts-v3.1.json');
  const srcPath = path.join(__dirname, '../../contexts/blockcerts-v3.1.json');
  if (fs.existsSync(distPath)) {
    return fs.readFileSync(distPath, 'utf8');
  } else if (fs.existsSync(srcPath)) {
    return fs.readFileSync(srcPath, 'utf8');
  } else {
    throw new Error('No se encontró blockcerts-v3.1.json en contexts ni dist/contexts');
  }
}

const localContexts = {
  '/contexts/blockcerts-v3.1.json': getBlockcertsContext()
};

const customLoader = (url) => {
  if (localContexts[url]) {
    return {
      contextUrl: null,
      document: JSON.parse(localContexts[url]),
      documentUrl: url
    };
  }
  return jsonld.documentLoaders.node()(url);
};

async function sha256Canonical(data) {
  const clone = JSON.parse(JSON.stringify(data));
  if (clone && typeof clone === 'object') {
    delete clone.proof;
  }

  const nquads = await jsonld.normalize(clone, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    documentLoader: customLoader
  });

  const hex = sha256Hex(nquads);
  return Buffer.from(hex, 'hex');
}

function buildMerkleWithDirectionalPaths(leaves) {
  if (!leaves.length) throw new Error('No hay hojas para el árbol de Merkle');

  let level = leaves.map((b) => b.toString('hex'));
  const levels = [level];

  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        next.push(sha256Hex(level[i] + level[i + 1]));
      } else {
        next.push(sha256Hex(level[i] + level[i]));
      }
    }
    levels.push(next);
    level = next;
  }
  const root = levels[levels.length - 1][0];

  const proofByLeafHex = {};
  const leafHexes = leaves.map((l) => l.toString('hex'));

  for (let leafIndex = 0; leafIndex < leafHexes.length; leafIndex++) {
    const path = [];
    let pos = leafIndex;

    for (let depth = 0; depth < levels.length - 1; depth++) {
      const current = levels[depth];
      const isLeft = pos % 2 === 0;
      const siblingIndex = isLeft ? pos + 1 : pos - 1;

      if (siblingIndex < current.length) {
        const sib = current[siblingIndex];
        path.push(isLeft ? { right: sib } : { left: sib });
      }
      pos = Math.floor(pos / 2);
    }
    proofByLeafHex[leafHexes[leafIndex]] = path;
  }

  return { root, proofByLeafHex };
}

async function generateTestCertificate() {
  try {
    console.log('🚀 Generating test certificate...');

    // 1. Create a template first
    const template = await prisma.template.create({
      data: {
        name: 'Test Certificate Template',
        description: 'Template for testing certificate generation',
        jsonLd: {
          recipientName: '{name}',
          recipientEmail: '{email}',
          course: '{course}',
          date: '{date}'
        },
        variables: ['name', 'email', 'course', 'date']
      }
    });

    console.log('✅ Template created:', template.id);

    // 2. Generate blockcert
    const blockcert = generateBlockcert({
      recipientName: 'Veronica Antezana',
      recipientEmail: 'veronica@example.com',
      course: 'Blockcerts Test Course',
      date: new Date().toISOString(),
      issuerName: 'Cert Issuer',
      issuerId: 'did:example:issuer',
      issuerPublicKey: '0x1234...abcd',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });

    console.log('✅ Blockcert generated');

    // 3. Create certificate
    const certificate = await prisma.certificate.create({
      data: {
        templateId: template.id,
        data: blockcert,
        status: 'PENDING',
      }
    });

    console.log('✅ Certificate created:', certificate.id);

    // 4. Calculate canonical hash
    const leaf = await sha256Canonical(blockcert);
    console.log('✅ Canonical hash calculated');

    // 5. Build Merkle tree (single leaf)
    const { root, proofByLeafHex } = buildMerkleWithDirectionalPaths([leaf]);
    console.log('✅ Merkle tree built, root:', root);

    // 6. Anchor to blockchain (mock for now)
    const txHash = `0xtest${Date.now().toString(16)}${root.slice(0, 8)}`;
    console.log('✅ Mock transaction hash:', txHash);

    // 7. Create anchor
    const anchor = await prisma.anchor.create({
      data: {
        rootHash: strip0x(root),
        txHash: strip0x(txHash),
        blockchain: 'sepolia',
        status: 'CONFIRMED',
        certificates: { connect: [{ id: certificate.id }] },
      }
    });

    console.log('✅ Anchor created:', anchor.id);

    // 8. Update certificate with proof
    const leafHex = leaf.toString('hex');
    const path = proofByLeafHex[leafHex] || [];
    const normalizedRoot = strip0x(root);
    const normalizedTx = strip0x(txHash);
    const contractAddress = process.env.ETHEREUM_ANCHOR_CONTRACT
      ? strip0x(process.env.ETHEREUM_ANCHOR_CONTRACT)
      : undefined;

    const proofData = {
      merkleRoot: normalizedRoot,
      targetHash: leafHex,
      anchors: [`btc:eth:sepolia:${ensure0x(normalizedTx)}`],
      path,
    };
    const encoder = new Encoder(proofData);
    const proofValueBase58 = encoder.encode().toString();

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const proofPayload = {
      type: 'MerkleProof2019',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${appUrl}/issuer.json#key-1`,
      merkleRoot: normalizedRoot,
      targetHash: leafHex,
      proofValue: proofValueBase58,
      anchors: [
        {
          type: 'ETHEREUM_SEPOLIA',
          value: ensure0x(normalizedTx),
          ...(contractAddress ? { contractAddress: ensure0x(contractAddress) } : {}),
        },
      ],
    };

    const updatedCertificate = await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'ISSUED',
        hash: leafHex,
        merkleProof: proofPayload,
        anchorId: anchor.id,
      }
    });

    console.log('✅ Certificate updated with proof');

    // 9. Generate the final blockcerts JSON
    const finalBlockcert = JSON.parse(JSON.stringify(blockcert));
    finalBlockcert.proof = proofPayload;

    // 10. Save to file
    const outputFile = 'certificate_new_corrected.json';
    fs.writeFileSync(outputFile, JSON.stringify(finalBlockcert, null, 2));
    console.log(`✅ Certificate saved to ${outputFile}`);

    console.log('\n🎉 Test certificate generated successfully!');
    console.log('Certificate ID:', certificate.id);
    console.log('Output file:', outputFile);
    console.log('Transaction hash:', txHash);

    return { certificate, outputFile, txHash };

  } catch (error) {
    console.error('❌ Error generating certificate:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateTestCertificate();

