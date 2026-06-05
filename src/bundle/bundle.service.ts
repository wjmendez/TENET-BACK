import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { AnchorService } from '../anchor/anchor.service.js';
import { IssuanceService } from '../issuance/issuance.service.js';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { QuotaService } from '../common/quota/quota.service.js';


@Injectable()
export class BundleService {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly anchorService: AnchorService,
    private readonly issuanceService: IssuanceService,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * Crea un bundle de credenciales (Carpeta de Egreso Digital)
   * 
   * @param verticalId ID de la vertical (EdTech)
   * @param recipientId Identificador del destinatario (email, DID, etc.)
   * @param templateIds IDs de los templates para cada credencial del bundle
   * @param recipientData Datos del destinatario para todas las credenciales
   * @param issuerDid DID de Veramo del usuario que emite (requerido)
   * @returns Bundle creado con todas sus credenciales
   */
  async createBundle(
    verticalId: string,
    recipientId: string,
    templateIds: {
      diploma: string;
      analitico: string;
      cartaRecomendacion?: string;
    },
    recipientData: any,
    issuerDid: string,
  ): Promise<any> {
    const tenantId = getTenantId();
    // 1. Verificar que la vertical existe y está activa
    const vertical = await prisma.vertical.findFirst({
      where: { id: verticalId, tenantId },
    });

    if (!vertical) {
      throw new Error(`Vertical with id ${verticalId} not found`);
    }

    if (!vertical.isActive) {
      throw new Error(`Vertical ${vertical.name} is not active`);
    }

    // 2. Verificar que los templates existen
    const templates = await prisma.template.findMany({
      where: {
        id: { in: Object.values(templateIds).filter(Boolean) as string[] },
        tenantId,
      },
    });

    if (templates.length !== Object.values(templateIds).filter(Boolean).length) {
      throw new Error('One or more templates not found');
    }

    // 3. Crear bundle
    const bundle = await prisma.credentialBundle.create({
      data: {
        tenantId,
        verticalId,
        recipientId,
        status: 'PENDING',
      },
    });

    // 4. Emitir cada credencial del bundle usando IssuanceService
    const credentials = await Promise.all([
      this.issuanceService.issueCredential({
        verticalId,
        templateId: templateIds.diploma,
        issuerDid,
        recipientData,
      }),
      this.issuanceService.issueCredential({
        verticalId,
        templateId: templateIds.analitico,
        issuerDid,
        recipientData,
      }),
      ...(templateIds.cartaRecomendacion
        ? [
            this.issuanceService.issueCredential({
              verticalId,
              templateId: templateIds.cartaRecomendacion,
              issuerDid,
              recipientData,
            }),
          ]
        : []),
    ]);

    // 5. Asociar credenciales al bundle
    const allCertificateIds = credentials.flat().map((c) => c.id);
    await prisma.certificate.updateMany({
      where: { id: { in: allCertificateIds }, tenantId },
      data: { bundleId: bundle.id, verticalId },
    });

    // 6. Obtener bundle actualizado con credenciales
    return this.getBundle(bundle.id);
  }

  /**
   * Ancla un bundle completo (más eficiente que anclar individualmente)
   * 
   * @param bundleId ID del bundle a anclar
   * @param blockchain Blockchain a usar (besu, sepolia, etc.)
   * @returns Anchor creado
   */
  async anchorBundle(bundleId: string, blockchain: string): Promise<any> {
    const tenantId = getTenantId();
    const bundle = await prisma.credentialBundle.findFirst({
      where: { id: bundleId, tenantId },
      include: { credentials: true },
    });

    if (!bundle) {
      throw new Error(`Bundle with id ${bundleId} not found`);
    }

    if (bundle.status !== 'PENDING') {
      throw new Error(`Bundle is not in PENDING status (current: ${bundle.status})`);
    }

    if (bundle.credentials.length === 0) {
      throw new Error('Bundle has no credentials to anchor');
    }

    // Anclar todas las credenciales del bundle en un solo batch
    const certificateIds = bundle.credentials.map((c) => c.id);
    const anchorResult = await this.anchorService.approveAndAnchor(certificateIds, blockchain);

    // approveAndAnchor puede retornar un solo anchor o un array, pero en este caso siempre será uno
    const anchor = Array.isArray(anchorResult) ? anchorResult[0] : anchorResult;
    if (!anchor) {
      throw new Error('No se pudo crear el anclaje para el bundle');
    }

    // Actualizar bundle con el anchor
    const updatedBundle = await prisma.credentialBundle.update({
      where: { id: bundleId },
      data: {
        anchorId: anchor.id,
        status: 'ISSUED',
        bundleHash: anchor.rootHash,
      },
    });

    return {
      bundle: updatedBundle,
      anchor,
    };
  }

  /**
   * Obtiene el bundle completo con todas sus credenciales
   * 
   * @param bundleId ID del bundle
   * @returns Bundle con todas sus credenciales y sus Blockcerts JSON
   */
  async getBundle(bundleId: string): Promise<any> {
    const tenantId = getTenantId();
    const bundle = await prisma.credentialBundle.findFirst({
      where: { id: bundleId, tenantId },
      include: {
        credentials: {
          include: {
            template: true,
            anchor: true,
          },
        },
        vertical: true,
        anchor: true,
      },
    });

    if (!bundle) {
      throw new Error(`Bundle with id ${bundleId} not found`);
    }

    // Obtener JSON Blockcerts de cada credencial (solo si están ancladas)
    const blockcerts = await Promise.all(
      bundle.credentials.map(async (cert) => {
        try {
          if (cert.status === 'ISSUED' && cert.anchor) {
            const blockcertJson = await this.certificateService.getBlockcertsJson(cert.id);
            return {
              id: cert.id,
              credentialUuid: cert.credentialUuid,
              templateName: cert.template.name,
              status: cert.status,
              blockcertsJson: blockcertJson,
            };
          } else {
            return {
              id: cert.id,
              credentialUuid: cert.credentialUuid,
              templateName: cert.template.name,
              status: cert.status,
              blockcertsJson: null,
              message: 'Credential not anchored yet',
            };
          }
        } catch (error: any) {
          return {
            id: cert.id,
            credentialUuid: cert.credentialUuid,
            templateName: cert.template.name,
            status: cert.status,
            error: error.message || 'Failed to get Blockcerts JSON',
          };
        }
      }),
    );

    return {
      id: bundle.id,
      vertical: {
        id: bundle.vertical.id,
        name: bundle.vertical.name,
        slug: bundle.vertical.slug,
      },
      recipientId: bundle.recipientId,
      status: bundle.status,
      bundleHash: bundle.bundleHash,
      anchor: bundle.anchor
        ? {
            id: bundle.anchor.id,
            rootHash: bundle.anchor.rootHash,
            txHash: bundle.anchor.txHash,
            blockchain: bundle.anchor.blockchain,
            status: bundle.anchor.status,
          }
        : null,
      credentials: blockcerts,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    };
  }

  /**
   * Lista todos los bundles de una vertical
   * 
   * @param verticalId ID de la vertical
   * @param status Filtro por status (opcional)
   * @returns Lista de bundles
   */
  async listBundlesByVertical(verticalId: string, status?: string): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.credentialBundle.findMany({
      where: {
        tenantId,
        verticalId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        vertical: true,
        anchor: true,
        _count: {
          select: {
            credentials: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Verifica un bundle completo
   * 
   * @param bundleId ID del bundle
   * @returns Resultado de la verificación
   */
  async verifyBundle(bundleId: string): Promise<any> {
    const tenantId = getTenantId();
    await this.quotaService.incrementVerifications(tenantId, 1);
    const bundle = await this.getBundle(bundleId);

    if (!bundle.anchor) {
      return {
        valid: false,
        reason: 'Bundle is not anchored',
      };
    }

    // Verificar cada credencial del bundle
    const verificationResults = await Promise.all(
      bundle.credentials.map(async (cred: any) => {
        if (!cred.blockcertsJson) {
          return {
            credentialId: cred.id,
            valid: false,
            reason: 'Credential not anchored',
          };
        }

        // Aquí se podría agregar verificación real del Blockcerts
        // Por ahora, solo verificamos que tenga proof
        const hasProof = cred.blockcertsJson.proof && (
          cred.blockcertsJson.proof.type === 'MerkleProof2019' ||
          (Array.isArray(cred.blockcertsJson.proof) && 
           cred.blockcertsJson.proof.some((p: any) => p.type === 'MerkleProof2019'))
        );

        return {
          credentialId: cred.id,
          templateName: cred.templateName,
          valid: hasProof,
          reason: hasProof ? 'Valid' : 'Missing MerkleProof2019',
        };
      }),
    );

    const allValid = verificationResults.every((r) => r.valid);

    return {
      bundleId: bundle.id,
      valid: allValid,
      anchor: bundle.anchor,
      credentials: verificationResults,
      verifiedAt: new Date().toISOString(),
    };
  }
}

