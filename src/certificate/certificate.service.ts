import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { Decoder, Encoder } from '@vaultie/lds-merkle-proof-2019';
import { generateBlockcertFromTemplate } from './blockcerts.util.js';
import { VeramoService } from '../veramo/veramo.service.js';
import { signBlockcertWithVeramo, validateBlockcertForVeramo } from './blockcerts-veramo.util.js';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { StatusListService } from '../status-list/status-list.service.js';
import { QuotaService } from '../common/quota/quota.service.js';


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

function resolveChainNetwork(anchorType?: string, blockchain?: string, chainNetworkSlug?: string): ChainNetwork | null {
  const normalizedType = (anchorType || '').toLowerCase();
  if (normalizedType.startsWith('ethereum_')) {
    const network = normalizedType.replace('ethereum_', '') || 'mainnet';
    return { chain: 'eth', network };
  }

  const normalizedBlockchain = (chainNetworkSlug || blockchain || '').toLowerCase();
  if (!normalizedBlockchain) {
    return null;
  }

  if (normalizedBlockchain === 'mocknet') {
    return { chain: 'mocknet', network: 'mocknet' };
  }
  if (normalizedBlockchain === 'sepolia') {
    return { chain: 'eth', network: 'sepolia' };
  }
  if (normalizedBlockchain === 'besu' || normalizedBlockchain === 'local') {
    return { chain: 'eth', network: 'besu' };
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
  constructor(
    private readonly veramoService: VeramoService,
    private readonly statusListService: StatusListService,
    private readonly quotaService: QuotaService,
  ) {}

  async issueBatch(
    templateId: string,
    recipients: any[],
    verticalId?: string,
    issuerDid?: string,
  ) {
    const tenantId = getTenantId();
    await this.quotaService.assertIssuanceQuota(tenantId, recipients.length);
    // Obtener la plantilla
    const template = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
      include: { issuer: true, vertical: true }, // Incluir issuer y vertical
    });
    if (!template) throw new Error('Template not found');

    // Verificar que tenga jsonLd (el canvas está dentro de jsonLd.credentialSubject.certificate.design)
    if (!template.jsonLd) {
      throw new Error('Template must have jsonLd');
    }

    // Determinar el DID del issuer
    // Prioridad: 1) issuerDid pasado como parámetro, 2) issuer del template, 3) desde jsonLd
    let finalIssuerDid: string | null = issuerDid || null;

    if (!finalIssuerDid) {
      // Opción 1: Desde la relación issuer del template
      if (template.issuer?.did) {
        finalIssuerDid = template.issuer.did;
      } else {
        // Opción 2: Desde jsonLd.issuer.id (puede tener variables)
        const jsonLdIssuer = (template.jsonLd as any)?.issuer;
        if (
          jsonLdIssuer?.id &&
          typeof jsonLdIssuer.id === 'string' &&
          !jsonLdIssuer.id.includes('{')
        ) {
          finalIssuerDid = jsonLdIssuer.id;
        }
      }
    }

    // Determinar el verticalId
    // Prioridad: 1) verticalId pasado como parámetro, 2) vertical del template
    const finalVerticalId = verticalId || template.verticalId || null;

    // Si no hay DID, no podemos firmar con Veramo (fallback a modo sin firma)
    if (!finalIssuerDid) {
      console.warn(
        `Template ${templateId} no tiene issuer DID. Los certificados se crearán sin firma de Veramo.`,
      );
    }

    const statusPurpose = 'revocation';
    const statusListSize = Number(process.env.STATUS_LIST_SIZE || 100000);

    // Para cada destinatario, generar Blockcerts y crear certificado
    const certificates = await Promise.all(
      recipients.map(async (recipient) => {
        let statusListInfo: { statusListId: string; statusListIndex: number } | null = null;
        if (finalIssuerDid) {
          const issuer = await prisma.issuer.findFirst({
            where: { did: finalIssuerDid, tenantId },
            select: { id: true },
          });
          if (issuer) {
            statusListInfo = await this.statusListService.allocateEntry(
              issuer.id,
              statusPurpose,
              statusListSize,
            );
          }
        }

        // Usar la nueva función que soporta templates completos con variables
        // Si el template tiene jsonLd completo, se usará; si no, se generará uno básico
        // Pasar finalIssuerDid para que se use correctamente en el issuer.id
        let blockcert = generateBlockcertFromTemplate(
          template,
          {
            ...recipient,
            id: recipient.id || undefined, // Para qrUrl si está disponible
          },
          finalIssuerDid || undefined, // Pasar el DID del issuer
        );

        if (statusListInfo) {
          const baseUrl = process.env.APP_URL || 'http://localhost:3000';
          const statusListCredential = `${baseUrl}/.well-known/status/${statusListInfo.statusListId}`;
          blockcert.credentialStatus = {
            id: `${statusListCredential}#${statusListInfo.statusListIndex}`,
            type: 'StatusList2021Entry',
            statusPurpose,
            statusListIndex: String(statusListInfo.statusListIndex),
            statusListCredential,
          };
        }

        // Firmar con Veramo si tenemos issuerDid
        if (finalIssuerDid && validateBlockcertForVeramo(blockcert)) {
          try {
            blockcert = await signBlockcertWithVeramo(
              blockcert,
              finalIssuerDid,
              this.veramoService,
            );
          } catch (error) {
            console.error(
              `Error al firmar certificado con Veramo: ${error.message}`,
            );
            // Continuar sin firma de Veramo si falla
          }
        }

        const credentialUuid = extractCredentialUuid(blockcert?.id);
        // Guardar el blockcert en el campo data (puede tener proof de Veramo o no)
        return prisma.certificate.create({
          data: {
            tenantId,
            templateId,
            data: blockcert,
            status: 'PENDING',
            ...(statusListInfo ? {
              statusListId: statusListInfo.statusListId,
              statusListIndex: statusListInfo.statusListIndex,
            } : {}),
            ...(finalVerticalId ? { verticalId: finalVerticalId } : {}),
            ...(finalIssuerDid ? { issuerDid: finalIssuerDid } : {}),
            ...(credentialUuid ? { credentialUuid } : {}),
          },
        });
      }),
    );
    return certificates;
  }

  async findAll(verticalId?: string) {
    const tenantId = getTenantId();
    return prisma.certificate.findMany({
      where: {
        tenantId,
        ...(verticalId ? { verticalId } : {}),
      },
      include: {
        template: true,
        vertical: true,
        anchor: { include: { chainNetwork: true } },
      },
    });
  }

  async findOne(id: string) {
    const tenantId = getTenantId();
    const lookupId = extractCredentialUuid(id) || id;
    let certificate = await prisma.certificate.findFirst({
      where: { id: lookupId, tenantId },
      include: { anchor: { include: { chainNetwork: true } } },
    });

    if (!certificate) {
      certificate = await prisma.certificate.findFirst({
        where: { credentialUuid: lookupId, tenantId },
        include: { anchor: { include: { chainNetwork: true } } },
      });
    }

    if (!certificate) throw new Error('Certificate not found');
    return certificate;
  }
  async revokeCertificate(id: string, reason?: string) {
    const tenantId = getTenantId();
    const certificate = await this.findCertificateForRevocation(id);
    const issuerId = await this.resolveIssuerIdForCertificate(certificate);
    const revokedAt = new Date();

    const revocation = await prisma.revocation.upsert({
      where: { certificateId: certificate.id },
      create: {
        tenantId,
        certificateId: certificate.id,
        issuerId,
        revokedAt,
        reason: reason || null,
        status: 'ACTIVE',
      },
      update: {
        tenantId,
        revokedAt,
        reason: reason || null,
        status: 'ACTIVE',
      },
    });

    await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'CANCELLED',
        revokedAt,
        revocationReason: reason || null,
      },
    });

    if (certificate.statusListId !== null && certificate.statusListIndex !== null) {
      await this.statusListService.updateEntry(
        certificate.statusListId,
        certificate.statusListIndex,
        true,
      );
    }

    return revocation;
  }

  async reinstateCertificate(id: string) {
    const tenantId = getTenantId();
    const certificate = await this.findCertificateForRevocation(id);

    const existingRevocation = await prisma.revocation.findUnique({
      where: { certificateId: certificate.id },
      select: { id: true },
    });

    if (!existingRevocation) {
      throw new Error('Revocation not found');
    }

    const revocation = await prisma.revocation.update({
      where: { certificateId: certificate.id },
      data: { status: 'REINSTATED', tenantId },
    });

    await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'ISSUED',
        revokedAt: null,
        revocationReason: null,
      },
    });

    if (certificate.statusListId !== null && certificate.statusListIndex !== null) {
      await this.statusListService.updateEntry(
        certificate.statusListId,
        certificate.statusListIndex,
        false,
      );
    }

    return revocation;
  }

  private async findCertificateForRevocation(id: string) {
    const tenantId = getTenantId();
    const lookupId = extractCredentialUuid(id) || id;
    let certificate = await prisma.certificate.findFirst({
      where: { id: lookupId, tenantId },
      include: {
        template: {
          select: {
            issuerId: true,
            issuer: { select: { id: true, did: true } },
          },
        },
      },
    });

    if (!certificate) {
      certificate = await prisma.certificate.findFirst({
        where: { credentialUuid: lookupId, tenantId },
        include: {
          template: {
            select: {
              issuerId: true,
              issuer: { select: { id: true, did: true } },
            },
          },
          statusList: { select: { id: true } },
        },
      });
    }

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    return certificate;
  }

  private async resolveIssuerIdForCertificate(certificate: {
    issuerDid?: string | null;
    template?: { issuerId?: string | null; issuer?: { id: string } | null } | null;
  }) {
    const tenantId = getTenantId();
    let issuerId = certificate.template?.issuerId || certificate.template?.issuer?.id || null;

    if (!issuerId && certificate.issuerDid) {
      const issuer = await prisma.issuer.findFirst({
        where: { did: certificate.issuerDid, tenantId },
        select: { id: true },
      });
      issuerId = issuer?.id || null;
    }

    if (!issuerId) {
      throw new Error('Issuer not resolved for certificate');
    }

    return issuerId;
  }

  async getBlockcertsJson(id: string) {
    const certificate = await this.findOne(id);
    if (!certificate.anchor) throw new Error('Certificate not anchored yet');
    if (certificate.status !== 'ISSUED') throw new Error('Credential not issued');

    // Validar que es EdTech (única vertical que usa Blockcerts)
    const tenantId = getTenantId();
    await this.quotaService.incrementVerifications(tenantId, 1);
    const vertical = certificate.verticalId
      ? await prisma.vertical.findFirst({ where: { id: certificate.verticalId, tenantId } })
      : null;
    
    // IMPORTANTE: Obtener el DID del issuer ANTES de procesar el blockcert
    // Esto asegura que podamos actualizar issuer.id y verificationMethod correctamente
    let issuerDid: string | null = certificate.issuerDid || null;

    if (vertical && vertical.slug !== 'edtech') {
      throw new Error(
        `Blockcerts format is only available for EdTech vertical. This credential belongs to ${vertical.name} vertical.`,
      );
    }

    // CRÍTICO: El data debe ser EXACTAMENTE el mismo que cuando se ancló
    // NO modificar campos que afecten el hash canónico (todo excepto proof)
    // Clone the stored credential so we don't mutate the DB copy. Mutating
    // issuer, credentialSubject, display, achievement, etc. after anchoring will change
    // the computed canonical hash and cause "Computed hash does not match remote hash".
    const blockcert = JSON.parse(JSON.stringify(certificate.data)) as any;

    // IMPORTANTE: Guardar una copia del certificado original para comparación
    // NO modificar ningún campo que no sea 'proof' antes de devolver

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
        certificate.anchor?.blockchain,
        certificate.anchor?.chainNetwork?.slug
      );
      const proofValueWithTx = ensureProofValueHasTx(mp.proofValue || '', chainNetwork, txHex);

      // Determinar el tipo de blockchain desde el anchor o el certificado
      const blockchainType = (() => {
        // Primero intentar desde el anchor entry
        if (anchorEntry && typeof anchorEntry !== 'string' && anchorEntry.type) {
          return anchorEntry.type;
        }
        // Luego desde el merkleProof almacenado
        if (mp.anchors && Array.isArray(mp.anchors) && mp.anchors[0]) {
          const storedAnchor = mp.anchors[0];
          if (typeof storedAnchor === 'object' && storedAnchor.type) {
            return storedAnchor.type;
          }
        }
        // Finalmente desde el blockchain del anchor en la BD
        if (certificate.anchor?.blockchain) {
          const bc = certificate.anchor.blockchain.toLowerCase();
          if (bc === 'besu' || bc === 'local') {
            return 'ETHEREUM_BESU';
          }
          if (bc === 'sepolia') {
            return 'ETHEREUM_SEPOLIA';
          }
        }
        // Default a SEPOLIA si no se puede determinar
        return 'ETHEREUM_SEPOLIA';
      })();

      // Obtener el DID del issuer desde el certificado o del blockcert
      let issuerDid: string | null = certificate.issuerDid || null;
      if (!issuerDid && blockcert.issuer) {
        if (typeof blockcert.issuer === 'string') {
          issuerDid = blockcert.issuer;
        } else if (blockcert.issuer.id) {
          issuerDid = blockcert.issuer.id;
        }
      }
      
      // Construir verificationMethod usando el DID si está disponible
      // IMPORTANTE: Debe coincidir EXACTAMENTE con el formato del Issuer Profile
      // El Issuer Profile tiene: verificationMethod[0].id = ${did}#${key.kid || 'key-1'}
      // Para Blockcerts, normalmente es `${did}#key-1`
      let defaultVerificationMethod: string;
      if (issuerDid && issuerDid.startsWith('did:')) {
        // Usar el DID directamente: did:web:domain:issuers:issuerId#key-1
        // NOTA: Si el Issuer Profile tiene un kid diferente, debemos usar ese
        // Por ahora, asumimos `key-1` que es el estándar de Blockcerts
        defaultVerificationMethod = `${issuerDid}#key-1`;
      } else {
        // Fallback a URL del issuer.json (compatibilidad con certificados antiguos)
        defaultVerificationMethod = `${baseUrl}/issuer.json#key-1`;
      }
      
      // Construir el MerkleProof2019
      // IMPORTANTE: Siempre usar defaultVerificationMethod para asegurar que coincida con el Issuer Profile
      // No usar mp.verificationMethod porque puede ser un valor antiguo que no coincide
      const merkleProof2019 = {
        type: mp.type || 'MerkleProof2019',
        created: mp.created || new Date().toISOString(),
        proofPurpose: mp.proofPurpose || 'assertionMethod',
        verificationMethod: defaultVerificationMethod, // Siempre usar el correcto, no el almacenado
        merkleRoot: mp.merkleRoot,
        targetHash: mp.targetHash,
        proofValue: proofValueWithTx,
        anchors: [
          normalizedTx
            ? {
              type: blockchainType,
              sourceId: normalizedTx,
              value: normalizedTx,
              ...(contractAddress ? { contractAddress: ensure0x(contractAddress) } : {}),
              // Para redes locales (Besu), agregar información adicional incluyendo RPC endpoint público
              ...(blockchainType === 'ETHEREUM_BESU' ? {
                chain: 'eth',
                network: 'besu',
                // Agregar RPC endpoint público si está configurado (para verificación)
                // El verificador puede usar esta URL para acceder a la blockchain local
                ...(process.env.BESU_PUBLIC_RPC_URL ? {
                  rpcUrl: process.env.BESU_PUBLIC_RPC_URL,
                } : {}),
              } : {}),
            }
            : null,
        ].filter((a) => a?.sourceId),
      } as any;

      if (!merkleProof2019.anchors.length) {
        throw new Error('Missing transaction hash in merkle proof; re-anchor the certificate.');
      }

      // FASE 4: Agregar MerkleProof2019 como segundo proof, preservando el proof de Veramo si existe
      const veramoProof = blockcert.proof;
      
      // Verificar si hay un proof de Veramo (tiene type diferente a MerkleProof2019)
      const hasVeramoProof = veramoProof && 
        veramoProof.type && 
        veramoProof.type !== 'MerkleProof2019' &&
        !Array.isArray(veramoProof);

      if (hasVeramoProof) {
        // Estrategia: Mantener ambos proofs
        // El MerkleProof2019 es el proof principal (para compatibilidad Blockcerts)
        // El proof de Veramo se preserva como segundo proof en un array
        blockcert.proof = [
          merkleProof2019,  // Proof principal (MerkleProof2019) - para verificadores Blockcerts
          veramoProof       // Proof secundario (Veramo) - para verificación criptográfica adicional
        ];
      } else {
        // Si no hay proof de Veramo, usar solo MerkleProof2019
        blockcert.proof = merkleProof2019;
      }
    }

    // Do NOT mutate fields that were present when the credential was anchored
    // (for example `issuer` or `credentialStatus`). Changing those will alter
    // the canonicalized representation and break verification.
    // Ensure the proof object has a verificationMethod but prefer values
    // coming from the stored merkleProof or the original credential.
    // NOTA: blockcert.proof puede ser un objeto único o un array de proofs
    // Si es un array, el primer elemento es el MerkleProof2019 (proof principal)
    if (!blockcert.proof) {
      blockcert.proof = {};
    }
    
    // Construir verificationMethod usando el DID si está disponible
    // (issuerDid ya fue extraído y blockcert.issuer.id ya fue actualizado arriba)
    // Formato: ${did}#key-1 (debe coincidir con el Issuer Profile)
    let defaultVerificationMethod: string;
    if (issuerDid && issuerDid.startsWith('did:')) {
      // Usar el DID directamente: did:web:domain:issuers:issuerId#key-1
      defaultVerificationMethod = `${issuerDid}#key-1`;
    } else {
      // Fallback a URL del issuer.json (compatibilidad con certificados antiguos)
      defaultVerificationMethod = `${baseUrl}/issuer.json#key-1`;
    }
    
    // Si proof es un array, asegurar que el primer elemento (MerkleProof2019) tenga verificationMethod
    if (Array.isArray(blockcert.proof)) {
      const storedMp: any = certificate.merkleProof as any;
      // IMPORTANTE: Usar siempre el defaultVerificationMethod para asegurar que coincida con el Issuer Profile
      // Si el certificado tiene un verificationMethod diferente, actualizarlo para que coincida
      if (blockcert.proof[0]) {
        blockcert.proof[0].verificationMethod = defaultVerificationMethod;
      }
    } else {
      // Si proof es un objeto único, asegurar que tenga verificationMethod
      // IMPORTANTE: Usar siempre el defaultVerificationMethod para asegurar que coincida con el Issuer Profile
      blockcert.proof.verificationMethod = defaultVerificationMethod;
    }

    // IMPORTANTE: El hash canónico se calcula excluyendo proof, display, displayHtml, certificate
    // (ver sha256Canonical en anchor.service.ts). Estos campos NO afectan el hash porque se excluyen
    // antes de normalizar.
    //
    // NOTA: Excluimos achievement y courseName del hash para evitar problemas de contexto.
    // Por lo tanto, debemos eliminarlos aquí también para que el verificador calcule el mismo hash.
    if (blockcert.credentialSubject?.achievement) {
      delete blockcert.credentialSubject.achievement;
    }
    if (blockcert.credentialSubject?.courseName) {
      delete blockcert.credentialSubject.courseName;
    }

    // SANITIZAR CONTEXTO: Igual que en anchor.service.ts
    if (Array.isArray(blockcert['@context'])) {
      blockcert['@context'] = blockcert['@context'].filter(c =>
        c === 'https://www.w3.org/2018/credentials/v1' ||
        c === 'https://w3id.org/blockcerts/v3' ||
        c === 'https://w3id.org/blockcerts/v3.1'
      );
    }

    // Eliminar certificate completo del credentialSubject (no está en el contexto estándar)
    // Esto se excluye en sha256Canonical, así que eliminarlo aquí no debería afectar el hash
    if (blockcert.credentialSubject?.certificate) {
      delete blockcert.credentialSubject.certificate;
    }

    // Migrar displayHtml ↔ display para compatibilidad: si falta displayHtml pero existe display, duplica
    if (blockcert.display && blockcert.display.content && !blockcert.displayHtml) {
      blockcert.displayHtml = blockcert.display.content;
    } else if (blockcert.displayHtml && !blockcert.display) {
      blockcert.display = {
        contentMediaType: 'text/html',
        content: blockcert.displayHtml
      };
    }

    // Asegurar definiciones locales en @context para display/displayHtml
    if (Array.isArray(blockcert['@context'])) {
      const context = blockcert['@context'];
      if (!context.includes('https://w3id.org/blockcerts/v3.1')) {
        context.push('https://w3id.org/blockcerts/v3.1');
      }
      const localObjIndex = context.findIndex((c: any) => typeof c === 'object');
      if (localObjIndex >= 0) {
        const localDefs = context[localObjIndex] as any;
        localDefs.display = localDefs.display || 'https://w3id.org/blockcerts#display';
        localDefs.displayHtml = localDefs.displayHtml || 'https://w3id.org/blockcerts#displayHtml';
        localDefs.content = localDefs.content || 'https://w3id.org/blockcerts#displayContent';
        localDefs.contentMediaType = localDefs.contentMediaType || 'https://w3id.org/blockcerts#displayContentMediaType';
        localDefs.metadata = localDefs.metadata || 'https://schema.org/additionalProperty';
      } else {
        context.push({
          display: 'https://w3id.org/blockcerts#display',
          displayHtml: 'https://w3id.org/blockcerts#displayHtml',
          content: 'https://w3id.org/blockcerts#displayContent',
          contentMediaType: 'https://w3id.org/blockcerts#displayContentMediaType',
          metadata: 'https://schema.org/additionalProperty'
        });
      }
      blockcert['@context'] = context;
    }

    // Procesar variables finales en display.content si existe (especialmente qrUrl con el ID real)
    // display se mantiene para renderizado visual, pero se excluye en sha256Canonical
    if (blockcert.display && blockcert.display.content && typeof blockcert.display.content === 'string') {
      const finalQrUrl = `${baseUrl}/certificates/${certificate.credentialUuid || certificate.id}/blockcerts`;
      // Reemplazar cualquier placeholder de qrUrl que quede
      blockcert.display.content = blockcert.display.content
        .replace(/\{\{qrUrl\}\}/g, finalQrUrl)
        .replace(/\{qrUrl\}/g, finalQrUrl)
        .replace(/http:\/\/localhost:3100\/certificates\/\//g, finalQrUrl)
        .replace(/http:\/\/localhost:3100\/certificates\/blockcerts/g, finalQrUrl);
    }

    // NOTA: display se mantiene en el certificado para renderizado visual (formato estándar W3C)
    // El verificador oficial de Blockcerts lo excluirá automáticamente antes de normalizar,
    // igual que se hace en sha256Canonical. Esto es correcto según el estándar W3C Verifiable Credentials:
    // display es solo para presentación y no debe incluirse en la normalización.
    // DEBUG: Ver qué estamos devolviendo
    console.log(`[GET] Credential ${id} returned to verifier:`);
    const debugClone = JSON.parse(JSON.stringify(blockcert));
    delete debugClone.proof;
    console.log(JSON.stringify(debugClone, null, 2));

    return blockcert;
  }

  /**
   * [DEBUG] Verifica que el hash canónico calculado coincida con el almacenado
   */
  async verifyHash(id: string) {
    const certificate = await this.findOne(id);
    if (!certificate.anchor) throw new Error('Certificate not anchored yet');
    if (certificate.status !== 'ISSUED') throw new Error('Credential not issued');

    // Importar la función sha256Canonical del anchor service
    const { sha256Canonical } = await import('../anchor/anchor.service.js');

    // Obtener el certificado tal como se devuelve
    const blockcert = await this.getBlockcertsJson(id);

    // Calcular el hash canónico del certificado devuelto
    const calculatedHash = await sha256Canonical(blockcert);
    const calculatedHashHex = calculatedHash.toString('hex');

    // Obtener el targetHash almacenado
    const storedMp: any = certificate.merkleProof as any;
    const storedTargetHash = storedMp?.targetHash || certificate.hash;

    // Comparar
    const match = calculatedHashHex === storedTargetHash;

    return {
      certificateId: id,
      match,
      calculatedHash: calculatedHashHex,
      storedTargetHash: storedTargetHash,
      difference: match ? null : {
        calculatedLength: calculatedHashHex.length,
        storedLength: storedTargetHash?.length || 0,
        firstDifference: (() => {
          if (!storedTargetHash) return 'No stored hash';
          for (let i = 0; i < Math.max(calculatedHashHex.length, storedTargetHash.length); i++) {
            if (calculatedHashHex[i] !== storedTargetHash[i]) {
              return `Position ${i}: calculated='${calculatedHashHex[i]}', stored='${storedTargetHash[i]}'`;
            }
          }
          return 'No difference found';
        })(),
      },
      certificateStructure: {
        hasProof: !!blockcert.proof,
        hasDisplay: !!blockcert.display,
        hasDisplayHtml: !!blockcert.displayHtml,
        hasAchievement: !!blockcert.credentialSubject?.achievement,
        hasCertificate: !!blockcert.credentialSubject?.certificate,
        type: blockcert.type,
        context: blockcert['@context'],
      },
    };
  }
}
