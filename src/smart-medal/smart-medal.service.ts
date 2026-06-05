import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { NFTService } from '../nft/nft.service.js';
import { UpdateService } from '../update/update.service.js';
import { getTenantId } from '../common/tenant/tenant-context.js';
import { CertificateService } from '../certificate/certificate.service.js';
import { AnchorService } from '../anchor/anchor.service.js';
import { IssuanceService } from '../issuance/issuance.service.js';


@Injectable()
export class SmartMedalService {
  constructor(
    private readonly nftService: NFTService,
    private readonly updateService: UpdateService,
    private readonly certificateService: CertificateService,
    private readonly anchorService: AnchorService,
    private readonly issuanceService: IssuanceService,
  ) {}

  /**
   * Crea un Smart Medal (NFT dinámico)
   * 
   * @param verticalId ID de la vertical (SportsTech)
   * @param templateId ID del template para el Smart Medal
   * @param issuerDid DID de Veramo del usuario que emite (requerido)
   * @param eventData Datos del evento deportivo
   * @returns Certificado y NFT creados
   */
  async createSmartMedal(
    verticalId: string,
    templateId: string,
    issuerDid: string,
    eventData: {
      eventName: string;
      participantName: string;
      participantEmail: string;
      eventId: string;
      participantId: string;
      thresholds: {
        gold: number; // tiempo en segundos
        silver: number;
        bronze: number;
      };
      timingApiUrl?: string; // URL base del API de timing
    },
  ): Promise<any> {
    // 1. Emitir certificado inicial usando IssuanceService (estado PARTICIPANT)
    const certificates = await this.issuanceService.issueCredential({
      verticalId,
      templateId,
      issuerDid,
      recipientData: {
        name: eventData.participantName,
        email: eventData.participantEmail,
        eventName: eventData.eventName,
        medalType: 'PARTICIPANT',
        finishTime: null,
        eventId: eventData.eventId,
        participantId: eventData.participantId,
        thresholds: eventData.thresholds,
      },
    });

    const certificate = certificates[0];

    // 2. Configurar política de actualización
    const timingApiUrl = eventData.timingApiUrl || process.env.TIMING_API_URL || 'http://localhost:3001';
    const updateEndpoint = `${timingApiUrl}/results/${eventData.eventId}/${eventData.participantId}`;

    await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        updatePolicy: {
          type: 'TIME_BASED',
          trigger: {
            source: 'external',
            endpoint: updateEndpoint,
            pollInterval: 30000, // 30 segundos
          },
          updateLogic: {
            rules: [
              {
                condition: `external.finishTime < ${eventData.thresholds.gold}`,
                action: {
                  medalType: 'GOLD',
                  metadata: { color: '#FFD700', tier: 1 },
                },
              },
              {
                condition: `external.finishTime < ${eventData.thresholds.silver}`,
                action: {
                  medalType: 'SILVER',
                  metadata: { color: '#C0C0C0', tier: 2 },
                },
              },
              {
                condition: `external.finishTime < ${eventData.thresholds.bronze}`,
                action: {
                  medalType: 'BRONZE',
                  metadata: { color: '#CD7F32', tier: 3 },
                },
              },
            ],
          },
        },
      },
    });

    // 3. Anclar certificado primero (requisito para mintear NFT)
    await this.anchorService.approveAndAnchor([certificate.id], 'besu');

    // 4. Mintear NFT
    // Obtener dirección del owner desde variables de entorno o usar la del participante
    const ownerAddress = process.env.NFT_OWNER_ADDRESS || 
                        process.env.BESU_PRE_FUNDED_ADDRESS || 
                        '0x627306090abab3a6e1400e9345bc60c78a8bef57';
    
    const nft = await this.nftService.mintNFT(certificate.id, ownerAddress);

    return {
      certificate: {
        id: certificate.id,
        credentialUuid: certificate.credentialUuid,
        status: certificate.status,
      },
      nft: {
        id: nft.id,
        tokenId: nft.tokenId,
        contractAddress: nft.contractAddress,
        ownerAddress: nft.ownerAddress,
        metadataURI: nft.metadataURI,
        status: nft.status,
      },
      updatePolicy: {
        endpoint: updateEndpoint,
        pollInterval: 30000,
      },
    };
  }

  /**
   * Actualiza Smart Medal basado en tiempo de carrera
   * 
   * @param credentialId ID del certificado (Smart Medal)
   * @returns Update aplicado o null
   */
  async updateMedalFromTiming(credentialId: string): Promise<any | null> {
    return this.updateService.checkAndApplyUpdates(credentialId);
  }

  /**
   * Obtiene historial de actualizaciones de un Smart Medal
   * 
   * @param credentialId ID del certificado
   * @returns Historial de actualizaciones
   */
  async getUpdateHistory(credentialId: string): Promise<any[]> {
    return this.updateService.getUpdateHistory(credentialId);
  }

  /**
   * Obtiene estado actual del Smart Medal
   * 
   * @param credentialId ID del certificado
   * @returns Estado actual con metadata
   */
  async getMedalStatus(credentialId: string): Promise<any> {
    const tenantId = getTenantId();
    const certificate = await prisma.certificate.findFirst({
      where: { id: credentialId, tenantId },
      include: {
        nft: true,
        template: {
          include: {
            credentialType: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new Error(`Certificate with id ${credentialId} not found`);
    }

    const data = certificate.data as any;
    const updateHistory = await this.getUpdateHistory(credentialId);

    return {
      id: certificate.id,
      credentialUuid: certificate.credentialUuid,
      eventName: data.eventName,
      participantName: data.participantName,
      medalType: data.medalType || 'PARTICIPANT',
      finishTime: data.finishTime || null,
      nft: certificate.nft
        ? {
            tokenId: certificate.nft.tokenId,
            contractAddress: certificate.nft.contractAddress,
            metadataURI: certificate.nft.metadataURI,
            ipfsHash: certificate.nft.ipfsHash,
          }
        : null,
      updateHistory: updateHistory.map((update) => ({
        updateType: update.updateType,
        updateData: update.updateData,
        appliedAt: update.appliedAt,
      })),
      lastUpdate: updateHistory[0] || null,
    };
  }
}

