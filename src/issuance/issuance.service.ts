import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { VeramoService } from '../veramo/veramo.service.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { getTenantId } from '../common/tenant/tenant-context.js';


@Injectable()
export class IssuanceService {
  constructor(
    private readonly veramoService: VeramoService,
    private readonly certificateService: CertificateService,
  ) {}

  /**
   * Emite una credencial validando vertical y DID del emisor
   * 
   * @param params Parámetros de emisión
   * @returns Certificados creados
   */
  async issueCredential(params: {
    verticalId: string;
    templateId: string;
    issuerDid: string; // DID de Veramo del usuario que emite
    recipientData: any;
  }): Promise<any[]> {
    const tenantId = getTenantId();
    // 1. Validar que la vertical existe y está activa
    const vertical = await prisma.vertical.findFirst({
      where: { id: params.verticalId, tenantId },
    });

    if (!vertical) {
      throw new Error(`Vertical with id ${params.verticalId} not found`);
    }

    if (!vertical.isActive) {
      throw new Error(`Vertical ${vertical.name} is not active`);
    }

    // 2. Validar que el template existe y pertenece al vertical
    const template = await prisma.template.findUnique({
      where: { id: params.templateId },
      include: { vertical: true, issuer: true },
    });

    if (!template) {
      throw new Error(`Template with id ${params.templateId} not found`);
    }

    if ((template as any).tenantId && (template as any).tenantId !== tenantId) {
      throw new Error(`Template ${params.templateId} does not belong to this tenant`);
    }

    if (template.verticalId && template.verticalId !== params.verticalId) {
      throw new Error(
        `Template ${params.templateId} does not belong to vertical ${params.verticalId}`,
      );
    }

    // 3. Validar o crear DID del emisor en Veramo
    let issuerDid = params.issuerDid;
    let veramoDid = await this.veramoService.getDid(issuerDid);

    if (!veramoDid) {
      // Si el DID no existe en Veramo, intentar crearlo
      // Esto permite que el usuario agregue su DID único
      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const domain = new URL(baseUrl).hostname;
      const issuerId = issuerDid.split(':').pop() || crypto.randomUUID();

      try {
        veramoDid = await this.veramoService.createIssuerDid(domain, issuerId);
        issuerDid = veramoDid.did;
      } catch (error) {
        throw new Error(
          `Failed to create DID ${issuerDid} in Veramo: ${error.message}`,
        );
      }
    }

    // 4. Validar que el issuer (si existe en BD) pertenece al vertical
    if (template.issuer) {
      if (
        template.issuer.verticalId &&
        template.issuer.verticalId !== params.verticalId
      ) {
        throw new Error(
          `Issuer ${template.issuer.did} does not belong to vertical ${params.verticalId}`,
        );
      }
    }

    // 5. Emitir certificados usando CertificateService con verticalId e issuerDid
    const certificates = await this.certificateService.issueBatch(
      params.templateId,
      [params.recipientData],
      params.verticalId,
      issuerDid,
    );

    return certificates;
  }

  /**
   * Busca o crea un DID para un emisor
   * Útil cuando el usuario quiere agregar su DID único
   * 
   * @param issuerDid DID del emisor (opcional, si no se proporciona se crea uno nuevo)
   * @param issuerName Nombre del emisor (para crear issuer en BD si no existe)
   * @returns DID de Veramo
   */
  async findOrCreateIssuerDid(
    issuerDid?: string,
    issuerName?: string,
  ): Promise<string> {
    if (issuerDid) {
      // Verificar si el DID existe en Veramo
      let veramoDid = await this.veramoService.getDid(issuerDid);

      if (!veramoDid) {
        // Crear el DID en Veramo si no existe
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const domain = new URL(baseUrl).hostname;
        const issuerId = issuerDid.split(':').pop() || crypto.randomUUID();

        veramoDid = await this.veramoService.createIssuerDid(domain, issuerId);
        issuerDid = veramoDid.did;
      }

      // Verificar si existe en BD, si no y tenemos nombre, crearlo
      if (issuerName) {
        const tenantId = getTenantId();
        const existingIssuer = await prisma.issuer.findFirst({
          where: { did: issuerDid, tenantId },
        });

        if (!existingIssuer) {
          await prisma.issuer.create({
            data: {
              tenantId,
              did: issuerDid,
              name: issuerName,
              publicKeyJwk: {},
            },
          });
        }
      }

      return issuerDid;
    }

    // Si no se proporciona DID, crear uno nuevo
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const domain = new URL(baseUrl).hostname;
    const issuerId = crypto.randomUUID();
    const veramoDid = await this.veramoService.createIssuerDid(
      domain,
      issuerId,
    );

    return veramoDid.did;
  }
}

