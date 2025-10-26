import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Decoder, Encoder } from '@vaultie/lds-merkle-proof-2019';
import { generateBlockcert } from './blockcerts.util.js';

const prisma = new PrismaClient();

function ensure0x(h: string) {
  const v = h.toLowerCase();
  return v.startsWith('0x') ? v : `0x${v}`;
}

function strip0x(h?: string | null) {
  return (h || '').toLowerCase().replace(/^0x/, '');
}

function extractCredentialUuid(rawId?: string | null) {
  if (!rawId) return null;
  return rawId.replace(/^urn:uuid:/i, '');
}

type ChainNetwork = { chain: string; network: string };

function resolveChainNetwork(anchorType?: string, blockchain?: string): ChainNetwork | null {
  const normalizedType = (anchorType || '').toLowerCase();
  if (normalizedType.startsWith('ethereum_')) {
    const network = normalizedType.replace('ethereum_', '') || 'mainnet';
    return { chain: 'eth', network };
  }

  const normalizedBlockchain = (blockchain || '').toLowerCase();
  if (!normalizedBlockchain) {
    return null;
  }

  if (normalizedBlockchain === 'mocknet') {
    return { chain: 'mocknet', network: 'mocknet' };
  }
  if (normalizedBlockchain === 'sepolia') {
    return { chain: 'eth', network: 'sepolia' };
  }
  if (['goerli', 'rinkeby', 'ropsten', 'mainnet'].includes(normalizedBlockchain)) {
    return { chain: 'eth', network: normalizedBlockchain };
  }
  if (normalizedBlockchain === 'mumbai') {
    return { chain: 'mtc', network: 'mumbai' };
  }

  return { chain: 'eth', network: normalizedBlockchain };
}

function buildBlinkAnchor(chainKey: string, networkKey: string, txHex: string) {
  return `blink:${chainKey}:${networkKey}:${txHex}`;
}

function ensureProofValueHasTx(
  proofValue: string,
  chainNetwork: ChainNetwork | null,
  txHex?: string
): string {
  if (!proofValue || !chainNetwork || !txHex) {
    return proofValue;
  }

  try {
    const decoder = new Decoder(proofValue);
    const decoded = decoder.decode() as any;
    const desiredAnchor = buildBlinkAnchor(chainNetwork.chain, chainNetwork.network, txHex);
    const anchors: string[] = Array.isArray(decoded.anchors) ? [...decoded.anchors] : [];
    const currentAnchor = anchors[0];
    const currentTx = currentAnchor ? currentAnchor.split(':').pop() : undefined;

    if (currentTx === txHex) {
      return proofValue;
    }

    if (anchors.length) {
      anchors[0] = desiredAnchor;
    } else {
      anchors.push(desiredAnchor);
    }

    const encoder = new Encoder({
      merkleRoot: decoded.merkleRoot,
      targetHash: decoded.targetHash,
      anchors,
      path: decoded.path || []
    });
    return encoder.encode().toString();
  } catch {
    return proofValue;
  }
}

@Injectable()
export class CertificateService {
  async issueBatch(templateId: string, recipients: any[]) {
    // Obtener la plantilla
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    // Para cada destinatario, generar Blockcerts y crear certificado
    const certificates = await Promise.all(recipients.map(async (recipient) => {
      // Reemplazo de variables en la plantilla
      let jsonLd = JSON.stringify(template.jsonLd);
      for (const key in recipient) {
        jsonLd = jsonLd.replace(new RegExp(`{${key}}`, 'g'), recipient[key]);
      }
      const parsedJsonLd = JSON.parse(jsonLd);
      // Generar Blockcerts
      const blockcert = generateBlockcert({
        recipientName: recipient.nombre || recipient.name,
        recipientEmail: recipient.email || 'test@example.com',
        course: recipient.curso || recipient.course,
        date: recipient.fecha || recipient.date,
        issuerName: template.name,
        issuerId: 'did:example:issuer',
        issuerPublicKey: '0x1234...abcd', // Ajusta según tu organización
        appUrl: process.env.APP_URL,
      });
      const credentialUuid = extractCredentialUuid(blockcert?.id);
      // Puedes guardar el blockcert en el campo data
      return prisma.certificate.create({
        data: {
          templateId,
          data: blockcert,
          status: 'PENDING',
          ...(credentialUuid ? { credentialUuid } : {}),
        },
      });
    }));
    return certificates;
  }

  async findAll() {
    return prisma.certificate.findMany();
  }

  async findOne(id: string) {
    const lookupId = extractCredentialUuid(id) || id;
    let certificate = await prisma.certificate.findUnique({
      where: { id: lookupId },
      include: { anchor: true },
    });

    if (!certificate) {
      certificate = await prisma.certificate.findUnique({
        where: { credentialUuid: lookupId },
        include: { anchor: true },
      });
    }

    if (!certificate) throw new Error('Certificate not found');
    return certificate;
  }

  async getBlockcertsJson(id: string) {
    const certificate = await this.findOne(id);
    if (!certificate.anchor) throw new Error('Certificate not anchored yet');
    if (certificate.status !== 'ISSUED') throw new Error('Credential not issued');

    // El data ya es el Blockcerts JSON base
    // Clone the stored credential so we don't mutate the DB copy. Mutating
    // issuer or credentialStatus after anchoring will change the computed
    // canonical hash and cause "Computed hash does not match remote hash".
    const blockcert = JSON.parse(JSON.stringify(certificate.data)) as any;

    const currentIssuerId = blockcert?.issuer?.id;
    const baseUrl =
      process.env.APP_URL ||
      (typeof currentIssuerId === 'string'
        ? currentIssuerId.replace(/\/issuer\.json$/i, '')
        : 'http://localhost:3000');

    // El proof ya está completo en merkleProof (BD), pero adaptamos anchors
    if (certificate.merkleProof) {
      const mp: any = certificate.merkleProof;

      const anchorEntry = Array.isArray(mp.anchors) ? mp.anchors[0] : undefined;
      const txHashFromProof = (() => {
        if (!anchorEntry) return undefined;
        if (typeof anchorEntry === 'string') {
          const parts = anchorEntry.split(':');
          return parts[parts.length - 1];
        }
        return anchorEntry.sourceId || anchorEntry.value;
      })();
      const txHashFromRelation = certificate.anchor?.txHash || undefined;
      const normalizedTx = (() => {
        const raw = txHashFromProof || txHashFromRelation;
        if (!raw) return undefined;
        try {
          return ensure0x(raw);
        } catch {
          return undefined;
        }
      })();
      const txHex = normalizedTx ? strip0x(normalizedTx) : undefined;

      const contractAddress =
        anchorEntry && typeof anchorEntry !== 'string'
          ? anchorEntry.contractAddress
          : undefined;
      const chainNetwork = resolveChainNetwork(
        anchorEntry && typeof anchorEntry !== 'string' ? anchorEntry.type : undefined,
        certificate.anchor?.blockchain
      );
      const proofValueWithTx = ensureProofValueHasTx(mp.proofValue || '', chainNetwork, txHex);

      // Construimos un proof exportable que el verificador entiende
      blockcert.proof = {
        type: mp.type || 'MerkleProof2019',
        created: mp.created || new Date().toISOString(),
        proofPurpose: mp.proofPurpose || 'assertionMethod',
        verificationMethod: mp.verificationMethod || `${baseUrl}/issuer.json#key-1`,
        merkleRoot: mp.merkleRoot,
        targetHash: mp.targetHash,
        proofValue: proofValueWithTx,
        anchors: [
          normalizedTx
            ? {
                type:
                  anchorEntry && typeof anchorEntry !== 'string' && anchorEntry.type
                    ? anchorEntry.type
                    : 'ETHEREUM_SEPOLIA',
                sourceId: normalizedTx,
                value: normalizedTx,
                ...(contractAddress ? { contractAddress: ensure0x(contractAddress) } : {}),
              }
            : null,
        ].filter((a) => a?.sourceId),
      } as any;

      if (!blockcert.proof.anchors.length) {
        throw new Error('Missing transaction hash in merkle proof; re-anchor the certificate.');
      }
    }

    // Do NOT mutate fields that were present when the credential was anchored
    // (for example `issuer` or `credentialStatus`). Changing those will alter
    // the canonicalized representation and break verification.
    // Ensure the proof object has a verificationMethod but prefer values
    // coming from the stored merkleProof or the original credential.
    blockcert.proof = blockcert.proof || {};
    const storedMp: any = certificate.merkleProof as any;
    blockcert.proof.verificationMethod =
      blockcert.proof.verificationMethod || (storedMp?.verificationMethod || `${baseUrl}/issuer.json#key-1`);

    return blockcert;
  }
}
