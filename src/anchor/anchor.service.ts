import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import * as dotenv from 'dotenv';
import { PrismaClient, CertificateStatus, AnchorStatus } from '@prisma/client';
import { Encoder } from '@vaultie/lds-merkle-proof-2019';
import { anchorToSepolia } from '../certificate/eth-anchor-anchorcontract.util.js';
// note: we use jsonld.normalize(..., { algorithm: 'URDNA2015', format: 'application/n-quads' })
// to produce deterministic N-Quads suitable for SHA-256 hashing (what the verifier expects)

dotenv.config();

const prisma = new PrismaClient();
const logger = pino({ name: 'AnchorService' });

/* -------------------------- utilidades de hashing -------------------------- */

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex'); // hex minúsculo
}

function strip0x(h?: string | null) {
  return (h || '').toLowerCase().replace(/^0x/, '');
}

function ensure0x(h: string) {
  const v = h.toLowerCase();
  return v.startsWith('0x') ? v : `0x${v}`;
}

/** Deep sort determinista de claves (estable) */
function deepSort(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSort);
  } else if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = deepSort(obj[k]);
        return acc;
      }, {});
  }
  return obj;
}

function resolveAnchorEncoding(blockchain?: string) {
  const normalized = (blockchain || '').toLowerCase();
  if (normalized === 'mocknet') {
    return { chain: 'mocknet', network: 'mocknet' };
  }
  if (normalized === 'sepolia') {
    return { chain: 'eth', network: 'sepolia' };
  }
  if (normalized === 'goerli') {
    return { chain: 'eth', network: 'goerli' };
  }
  if (normalized === 'rinkeby') {
    return { chain: 'eth', network: 'rinkeby' };
  }
  if (normalized === 'ropsten') {
    return { chain: 'eth', network: 'ropsten' };
  }
  if (normalized === 'mumbai') {
    return { chain: 'mtc', network: 'mumbai' };
  }
  return { chain: 'eth', network: normalized || 'mainnet' };
}

function buildBlinkAnchor(chainKey: string, networkKey: string, txHex: string) {
  return `blink:${chainKey}:${networkKey}:${txHex}`;
}

/**
 * Canonicaliza y hashea en SHA-256 usando JSON-LD canonicalization (URDNA2015).
 * Debe coincidir EXACTAMENTE con el proceso que usa el verificador de Blockcerts.
 */

// Loader local para contextos JSON-LD compatible con ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getBlockcertsContext() {
  // Busca primero en dist/contexts, luego en contexts
  const distPath = path.join(__dirname, '../../contexts/blockcerts-v3.1.json');
  const srcPath = path.join(__dirname, '../../../contexts/blockcerts-v3.1.json');
  if (fs.existsSync(distPath)) {
    return fs.readFileSync(distPath, 'utf8');
  } else if (fs.existsSync(srcPath)) {
    return fs.readFileSync(srcPath, 'utf8');
  } else {
    throw new Error('No se encontró blockcerts-v3.1.json en contexts ni dist/contexts');
  }
}

const localContexts: Record<string, string> = {
  '/contexts/blockcerts-v3.1.json': getBlockcertsContext()
};

const customLoader = (url: string) => {
  if (localContexts[url]) {
    return {
      contextUrl: null,
      document: JSON.parse(localContexts[url]),
      documentUrl: url
    };
  }
  // fallback al loader por defecto
  return jsonld.documentLoaders.node()(url);
};

async function sha256Canonical(data: any): Promise<Buffer> {
  // Clona para no mutar
  const clone = JSON.parse(JSON.stringify(data));

  // Excluye `proof` del payload hashable (estándar en Blockcerts)
  if (clone && typeof clone === 'object') {
    delete clone.proof;
  }

  // Use jsonld.normalize to produce N-Quads using URDNA2015
  // This yields the deterministic representation the verifier uses.
  const nquads = await jsonld.normalize(clone, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    documentLoader: customLoader
  });

  if (process.env.DEBUG_CANON === '1') {
    // Print canonicalized N-Quads and hash for debugging
    // (You can diff this with the verifier's canonicalization)
    // Only print for the first few to avoid log spam
    if (!globalThis.__canon_debug_count) globalThis.__canon_debug_count = 0;
    if (globalThis.__canon_debug_count < 5) {
      console.log('--- CANONICALIZED N-QUADS ---');
      console.log(nquads);
      const hex = sha256Hex(nquads);
      console.log('SHA256(N-Quads):', hex);
      globalThis.__canon_debug_count++;
    }
  }

  const hex = sha256Hex(nquads);
  return Buffer.from(hex, 'hex');
}

/* ------------------------- merkle con rutas left/right ------------------------- */

function buildMerkleWithDirectionalPaths(leaves: Buffer[]): {
  root: string; // hex minúsculo sin 0x
  proofByLeafHex: Record<string, Array<{ left?: string; right?: string }>>;
} {
  if (!leaves.length) throw new Error('No hay hojas para el árbol de Merkle');

  let level: string[] = leaves.map((b) => b.toString('hex'));
  const levels: string[][] = [level];

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        // parent = sha256(left||right)
        next.push(sha256Hex(level[i] + level[i + 1]));
      } else {
  // impar: duplicamos el último (no lo promovemos)
  // parent = sha256(last||last)
  next.push(sha256Hex(level[i] + level[i]));
      }
    }
    levels.push(next);
    level = next;
  }
  const root = levels[levels.length - 1][0];

  const proofByLeafHex: Record<string, Array<{ left?: string; right?: string }>> = {};
  const leafHexes = leaves.map((l) => l.toString('hex'));

  for (let leafIndex = 0; leafIndex < leafHexes.length; leafIndex++) {
    const path: Array<{ left?: string; right?: string }> = [];
    let pos = leafIndex;

    for (let depth = 0; depth < levels.length - 1; depth++) {
      const current = levels[depth];
      const isLeft = pos % 2 === 0;
      const siblingIndex = isLeft ? pos + 1 : pos - 1;

      if (siblingIndex < current.length) {
        const sib = current[siblingIndex];
        // si soy left, sibling va a la derecha (right), y viceversa
        path.push(isLeft ? { right: sib } : { left: sib });
      }
      pos = Math.floor(pos / 2);
    }
    proofByLeafHex[leafHexes[leafIndex]] = path;
  }

  return { root, proofByLeafHex };
}

/* --------------------------------- servicio --------------------------------- */

@Injectable()
export class AnchorService {
  /**
   * - Calcula hashes canónicos (hojas)
   * - Construye Merkle + paths (left/right)
   * - Ancla root en contrato (obtiene txid)
   * - Persist a Anchor y actualiza cada Certificate con MerkleProof2019:
   *   type, merkleRoot, targetHash, proofValue(Base58), anchors([{ type:'ETHData', value: <txid> }])
   */
  async approveAndAnchor(certificateIds: string[], blockchain: string) {
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      throw new Error('certificateIds no puede estar vacío');
    }

    const chunkSize = 100;
    const anchors: Awaited<ReturnType<typeof prisma.anchor.create>>[] = [];

    for (let i = 0; i < certificateIds.length; i += chunkSize) {
      const chunkIds = certificateIds.slice(i, i + chunkSize);

      // 1) Cargar certificados PENDING
      const certs = await prisma.certificate.findMany({
        where: { id: { in: chunkIds }, status: CertificateStatus.PENDING },
      });
      if (certs.length === 0) {
        logger.warn({ chunkIds }, 'No hay certificados PENDING en este chunk');
        continue;
      }

      // 2) Leaves canónicas (Buffer) —> Debe coincidir con lo que usaste al emitir
      if (process.env.DEBUG_CANON === '1') {
        console.log('==== DEBUG: Exported credential (no proof) for each cert ===');
      }
      const leaves: Buffer[] = await Promise.all(certs.map((c, idx) => {
        if (process.env.DEBUG_CANON === '1') {
          const clone = JSON.parse(JSON.stringify(c.data));
          delete clone.proof;
          console.log(`Credential #${idx} (no proof):`);
          console.dir(clone, { depth: 10 });
        }
        return sha256Canonical(c.data);
      }));

      // 3) Merkle + rutas
      const t0 = Date.now();
      const { root, proofByLeafHex } = buildMerkleWithDirectionalPaths(leaves);
      const t1 = Date.now();
      if (!root) throw new Error('Merkle root vacío');

      logger.info(
        {
          numLeaves: leaves.length,
          root,
          buildTimeMs: t1 - t0,
          exampleProofLen:
            leaves.length ? (proofByLeafHex[leaves[0].toString('hex')]?.length ?? 0) : 0,
        },
        'Merkle tree construido'
      );
      if (process.env.DEBUG_CANON === '1') {
        console.log('==== DEBUG: Merkle root (local):', root);
      }

      // 4) Anclar root y obtener txHash (0x...)
      let txHash: string;
      if (blockchain === 'sepolia') {
        try {
          txHash = await anchorToSepolia({
            merkleRoot: root, // hex sin 0x
            privateKey: process.env.ETHEREUM_PRIVATE_KEY!,
            rpcUrl: process.env.ETHEREUM_RPC_URL!,
            dataSinkAddress: process.env.ETHEREUM_DATA_SINK,
          });
          logger.info({ txHash }, 'Transacción enviada');
        } catch (err: any) {
          logger.error(
            { err: err?.message || err },
            'Fallo anclando en sepolia; no se generará txHash mock'
          );
          throw new Error(`Ethereum anchoring failed: ${err?.message || err}`);
        }
      } else {
        txHash = `0xmock${Date.now().toString(16)}${root.slice(0, 8)}`;
      }

      // 5) Persistir Anchor + actualizar pruebas en cada certificado
      const appUrl = process.env.APP_URL;
      const normalizedRoot = strip0x(root);
      const normalizedTx = strip0x(txHash);

      const [createdAnchor] = await prisma.$transaction([
        prisma.anchor.create({
          data: {
            rootHash: normalizedRoot,   // guardamos sin 0x
            txHash: normalizedTx,       // guardamos sin 0x
            blockchain,
            status: AnchorStatus.CONFIRMED, // en prod, PENDING hasta N confirmaciones
            certificates: { connect: certs.map((c) => ({ id: c.id })) },
          },
        }),
        ...certs.map((c, idx) => {
          const leafHex = leaves[idx].toString('hex'); // targetHash (hex minúsculo)
          const path = proofByLeafHex[leafHex] || [];

          // Codificar path+root+target en Base58 (MerkleProof2019)
          const txWithPrefix = ensure0x(normalizedTx);
          const { chain: chainKey, network: networkKey } = resolveAnchorEncoding(blockchain);
          const txHex = strip0x(txWithPrefix);
          const proofData = {
            merkleRoot: normalizedRoot,
            targetHash: leafHex,
            anchors: [buildBlinkAnchor(chainKey, networkKey, txHex)], // string requerido por el encoder
            path, // [{left},{right},...]
          };
          const encoder = new Encoder(proofData);
          const proofValueBase58 = encoder.encode().toString(); // Base58

          // Estructura de proof que consume cert-verifier-js
          const proofPayload: any = {
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
                sourceId: txWithPrefix,
                value: txWithPrefix, // mantener `value` por compatibilidad
              },
            ],
          };

          return prisma.certificate.update({
            where: { id: c.id },
            data: {
              status: CertificateStatus.ISSUED,
              hash: leafHex,
              merkleProof: proofPayload,
              anchorId: undefined, // la relación se establece con connect arriba
            },
          });
        }),
      ]);

      anchors.push(createdAnchor);
    }

    if (anchors.length === 0) {
      throw new Error('No se creó ningún anclaje; revisa IDs/estados.');
    }
    return anchors.length === 1 ? anchors[0] : anchors;
  }

  async findAll() {
    return prisma.anchor.findMany({ include: { certificates: true } });
  }
}
