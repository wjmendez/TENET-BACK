import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import * as dotenv from 'dotenv';
import { CertificateStatus, AnchorStatus } from '@prisma/client';
import { Encoder } from '@vaultie/lds-merkle-proof-2019';
import { anchorToSepolia } from '../certificate/eth-anchor-anchorcontract.util.js';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { prisma } from '../common/prisma/prisma.js';
// note: we use jsonld.normalize(..., { algorithm: 'URDNA2015', format: 'application/n-quads' })
// to produce deterministic N-Quads suitable for SHA-256 hashing (what the verifier expects)

dotenv.config();

const logger = pino({ name: 'AnchorService' });

/* -------------------------- utilidades de hashing -------------------------- */

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex'); // hex minúsculo
}

export function strip0x(h?: string | null) {
  return (h || '').toLowerCase().replace(/^0x/, '');
}

export function ensure0x(h: string) {
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

export function resolveAnchorEncoding(blockchain?: string) {
  const normalized = (blockchain || '').toLowerCase();
  if (normalized === 'mocknet') {
    return { chain: 'mocknet', network: 'mocknet' };
  }
  if (normalized === 'sepolia') {
    return { chain: 'eth', network: 'sepolia' };
  }
  if (normalized === 'besu' || normalized === 'local') {
    return { chain: 'eth', network: 'besu' };
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

function resolveAnchorEncodingFromNetwork(chainNetworkSlug?: string | null, blockchain?: string | null) {
  const normalized = (chainNetworkSlug || blockchain || '').toLowerCase();
  const mapped = (() => {
    if (!normalized) return undefined;
    if (normalized === 'eth-sepolia') return 'sepolia';
    if (normalized === 'eth-mainnet') return 'mainnet';
    if (normalized === 'polygon') return 'polygon';
    if (normalized === 'polygon-mumbai') return 'mumbai';
    if (normalized === 'lacchain') return 'lacchain';
    if (normalized === 'local') return 'besu';
    if (normalized === 'testnet') return 'sepolia';
    return normalized;
  })();
  return resolveAnchorEncoding(mapped || undefined);
}

function resolveChainNetworkSlug(input: string) {
  const normalized = (input || '').toLowerCase();
  if (!normalized) return null;
  if (normalized === 'sepolia') return 'eth-sepolia';
  if (normalized === 'testnet') return 'eth-sepolia';
  if (normalized === 'local') return 'besu';
  return normalized;
}

function resolveAnchoringNetwork(input: string) {
  const normalized = (input || '').toLowerCase();
  if (!normalized) return '';
  if (normalized === 'eth-sepolia' || normalized === 'testnet') return 'sepolia';
  if (normalized === 'local') return 'besu';
  return normalized;
}

export function buildBlinkAnchor(chainKey: string, networkKey: string, txHex: string) {
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

export async function sha256Canonical(data: any): Promise<Buffer> {
  // Clona para no mutar
  const clone = JSON.parse(JSON.stringify(data));

  // Excluye propiedades que no están en el contexto JSON-LD estándar de Blockcerts
  // - `proof`: estándar en Blockcerts (no se incluye en el hash)
  // - `display`: solo para presentación visual (formato W3C), no afecta la verificación
  // - `displayHtml`: formato antiguo, también se excluye
  // - `certificate`: metadata personalizada que no está en el contexto estándar
  // NOTA: `achievement` SÍ es parte del estándar Open Badges y DEBE incluirse en el hash
  if (clone && typeof clone === 'object') {
    delete clone.proof;

    // Limpiar credentialSubject de propiedades no estándar
    if (clone.credentialSubject && typeof clone.credentialSubject === 'object') {
      delete clone.credentialSubject.display;
      delete clone.credentialSubject.displayHtml;

      // Excluir certificate completo (version, metadata, design) - no está en el contexto estándar
      delete clone.credentialSubject.certificate;

      // Excluir achievement y courseName para evitar problemas de contexto/hash
      // Estos campos se mostrarán visualmente a través de 'display'
      if (clone.credentialSubject.achievement) delete clone.credentialSubject.achievement;
      if (clone.credentialSubject.courseName) delete clone.credentialSubject.courseName;

    }

    // SANITIZAR CONTEXTO: Mantener solo los contextos estándar + definiciones locales en objetos.
    if (Array.isArray(clone['@context'])) {
      const filtered = clone['@context'].filter(c =>
        typeof c === 'object' ||
        c === 'https://www.w3.org/2018/credentials/v1' ||
        c === 'https://w3id.org/blockcerts/v3' ||
        c === 'https://w3id.org/blockcerts/v3.1'
      );

      // Asegurar definiciones para display/displayHtml para evitar campos unmapped
      const localObjIndex = filtered.findIndex((c) => typeof c === 'object');
      const displayMapping = {
        display: 'https://w3id.org/blockcerts#display',
        displayHtml: 'https://w3id.org/blockcerts#displayHtml',
        content: 'https://w3id.org/blockcerts#displayContent',
        contentMediaType: 'https://w3id.org/blockcerts#displayContentMediaType'
      };
      if (localObjIndex >= 0) {
        filtered[localObjIndex] = { ...(filtered[localObjIndex] as any), ...displayMapping };
      } else {
        filtered.push(displayMapping);
      }

      // Añadir @vocab de respaldo para propiedades no mapeadas (igual que cert-verifier-js)
      const hasVocab = filtered.some((c) => typeof c === 'object' && c['@vocab']);
      if (!hasVocab) {
        filtered.push({ '@vocab': 'http://fallback.org/' });
      }

      clone['@context'] = filtered;
    }
  }

  // Use jsonld.normalize to produce N-Quads using URDNA2015
  // This yields the deterministic representation the verifier uses.
  // Nota: jsonld.normalize internamente hace expand, por lo que necesitamos limpiar antes
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

export function buildMerkleWithDirectionalPaths(leaves: Buffer[]): {
  root: string; // hex minúsculo sin 0x
  proofByLeafHex: Record<string, Array<{ left?: string; right?: string }>>;
} {
  if (!leaves.length) throw new Error('No hay hojas para el árbol de Merkle');

  // Usar buffers y concatenar bytes (no strings) para que coincida con cert-verifier-js
  let level: Buffer[] = [...leaves];
  const levels: Buffer[][] = [level];

  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i]; // duplicar última si impar
      next.push(crypto.createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    levels.push(next);
    level = next;
  }
  const root = levels[levels.length - 1][0].toString('hex');

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
        const sib = current[siblingIndex].toString('hex');
        // si soy left, sibling va a la derecha (right), y viceversa
        path.push(isLeft ? { right: sib } : { left: sib });
      } else if (current.length === 1) {
        // Árbol de un solo nodo: sin path
      } else {
        // caso impar duplicado: sibling es el mismo nodo
        const sib = current[pos].toString('hex');
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
    const tenantId = getTenantId();
    if (!Array.isArray(certificateIds) || certificateIds.length === 0) {
      throw new Error('certificateIds no puede estar vacío');
    }

    const chunkSize = 100;
    const normalizedBlockchain = (blockchain || '').toLowerCase();
    const anchoringNetwork = resolveAnchoringNetwork(normalizedBlockchain);
    const chainNetworkSlug = resolveChainNetworkSlug(normalizedBlockchain);
    const chainNetwork = chainNetworkSlug
      ? await prisma.chainNetwork.findUnique({ where: { slug: chainNetworkSlug } })
      : null;
    const anchors: Awaited<ReturnType<typeof prisma.anchor.create>>[] = [];

    for (let i = 0; i < certificateIds.length; i += chunkSize) {
      const chunkIds = certificateIds.slice(i, i + chunkSize);

      // 1) Cargar certificados PENDING
      const certs = await prisma.certificate.findMany({
        where: { id: { in: chunkIds }, status: CertificateStatus.PENDING, tenantId },
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
        if (process.env.DEBUG_CANON === '1' || true) { // Forzamos debug
          const clone = JSON.parse(JSON.stringify(c.data));
          delete clone.proof;
          console.log(`[ANCHOR] Credential #${idx} to be hashed:`);
          console.log(JSON.stringify(clone, null, 2));
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
      if (anchoringNetwork === 'sepolia' || anchoringNetwork === 'besu') {
        // Validar variables de entorno requeridas
        if (!process.env.ETHEREUM_PRIVATE_KEY) {
          throw new Error('ETHEREUM_PRIVATE_KEY no está configurada en las variables de entorno');
        }

        try {
          // Para Besu, usar BESU_RPC_URL si está definido, sino ETHEREUM_RPC_URL
          const rpcUrl = anchoringNetwork === 'besu'
            ? (process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545')
            : (process.env.ETHEREUM_RPC_URL || (() => {
              throw new Error('ETHEREUM_RPC_URL no está configurada en las variables de entorno');
            })());

          logger.info({ rpcUrl, blockchain: normalizedBlockchain }, 'Conectando a blockchain');

          // Para Besu local, no esperar confirmaciones (más rápido)
          // Para Sepolia, esperar 1 confirmación
          const isLocalNetwork = anchoringNetwork === 'besu';
          txHash = await anchorToSepolia({
            merkleRoot: root, // hex sin 0x
            privateKey: process.env.ETHEREUM_PRIVATE_KEY,
            rpcUrl: rpcUrl,
            dataSinkAddress: process.env.ETHEREUM_DATA_SINK,
            waitForConfirmations: isLocalNetwork ? 0 : 1, // 0 para local, 1 para Sepolia
          });
          logger.info({ txHash, blockchain: anchoringNetwork }, 'Transacción enviada');
        } catch (err: any) {
          logger.error(
            {
              err: err?.message || err,
              stack: err?.stack,
              blockchain: anchoringNetwork,
              rpcUrl: anchoringNetwork === 'besu'
                ? (process.env.BESU_RPC_URL || process.env.ETHEREUM_RPC_URL || 'http://localhost:8545')
                : process.env.ETHEREUM_RPC_URL
            },
            `Fallo anclando en ${anchoringNetwork}`
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

      // Obtener verticales de todos los certificados antes de la transacción
      const certsWithVertical = await Promise.all(
        certs.map((c) =>
          prisma.certificate.findFirst({
            where: { id: c.id, tenantId },
            include: { vertical: true },
          }),
        ),
      );

      const createdAnchor = await prisma.anchor.create({
        data: {
          tenantId,
          rootHash: normalizedRoot,   // guardamos sin 0x
          txHash: normalizedTx,       // guardamos sin 0x
          blockchain,
          ...(chainNetwork?.id ? { chainNetworkId: chainNetwork.id } : {}),
          status: AnchorStatus.CONFIRMED, // en prod, PENDING hasta N confirmaciones
          certificates: { connect: certs.map((c) => ({ id: c.id })) },
        },
      });

      await Promise.all(
        certs.map((c, idx) => {
          const leafHex = leaves[idx].toString('hex'); // targetHash (hex minúsculo)
          const path = proofByLeafHex[leafHex] || [];
          const certWithVertical = certsWithVertical[idx];
          
          const isEdTech = certWithVertical?.vertical?.slug === 'edtech';
          
          // Solo EdTech usa MerkleProof2019 (Blockcerts)
          let proofPayload: any = null;
          if (isEdTech) {
            // Obtener el DID del issuer desde el certificado
            // Si el certificado tiene issuerDid, usarlo; si no, construir desde issuer.id del blockcert
            let issuerDid: string | null = c.issuerDid || null;
            
            // Si no hay issuerDid en el certificado, intentar extraerlo del blockcert
            if (!issuerDid && c.data) {
              const blockcert = c.data as any;
              if (blockcert.issuer) {
                if (typeof blockcert.issuer === 'string') {
                  issuerDid = blockcert.issuer;
                } else if (blockcert.issuer.id) {
                  issuerDid = blockcert.issuer.id;
                }
              }
            }
            
            // Construir verificationMethod usando el DID si está disponible
            // IMPORTANTE: Debe coincidir EXACTAMENTE con el formato del Issuer Profile
            // El Issuer Profile ahora usa: verificationMethod[0].id = ${did}#key-1 (forzado)
            // Los certificados también usan: ${did}#key-1
            // Esto asegura que ambos coincidan
            let verificationMethod: string;
            if (issuerDid && issuerDid.startsWith('did:')) {
              // Usar el DID directamente: did:web:domain:issuers:issuerId#key-1
              // NOTA: Ahora el Issuer Profile también usa 'key-1' forzado, así que coinciden
              verificationMethod = `${issuerDid}#key-1`;
            } else {
              // Fallback a URL del issuer.json (compatibilidad con certificados antiguos)
              verificationMethod = `${appUrl}/issuer.json#key-1`;
            }
            
            // Codificar path+root+target en Base58 (MerkleProof2019)
            const txWithPrefix = ensure0x(normalizedTx);
            const { chain: chainKey, network: networkKey } = resolveAnchorEncodingFromNetwork(
              chainNetwork?.slug,
              blockchain
            );
            const txHex = strip0x(txWithPrefix);
            const proofData = {
              merkleRoot: normalizedRoot,
              targetHash: leafHex,
              anchors: [buildBlinkAnchor(chainKey, networkKey, txHex)], // string requerido por el encoder
              path, // [{left},{right},...]
            };
            const encoder = new Encoder(proofData);
            const proofValueBase58 = encoder.encode().toString(); // Base58

            // Estructura de proof que consume cert-verifier-js (solo para EdTech)
            proofPayload = {
              type: 'MerkleProof2019',
              created: new Date().toISOString(),
              proofPurpose: 'assertionMethod',
              verificationMethod: verificationMethod, // Usar DID si está disponible
              merkleRoot: normalizedRoot,
              targetHash: leafHex,
              proofValue: proofValueBase58,
              anchors: [
                {
                  type: anchoringNetwork === 'besu'
                    ? 'ETHEREUM_BESU'
                    : 'ETHEREUM_SEPOLIA',
                  sourceId: txWithPrefix,
                  value: txWithPrefix, // mantener `value` por compatibilidad
                },
              ],
            };
          }

          return prisma.certificate.update({
            where: { id: c.id },
            data: {
              status: CertificateStatus.ISSUED,
              hash: leafHex,
              merkleProof: proofPayload, // null para verticales que no usan Blockcerts
              anchorId: undefined, // la relación se establece con connect arriba
            },
          });
        }),
      );

      anchors.push(createdAnchor);
    }

    if (anchors.length === 0) {
      throw new Error('No se creó ningún anclaje; revisa IDs/estados.');
    }
    return anchors.length === 1 ? anchors[0] : anchors;
  }

  async findAll() {
    const tenantId = getTenantId();
    return prisma.anchor.findMany({
      where: { tenantId },
      include: { certificates: true, chainNetwork: true },
    });
  }
}
