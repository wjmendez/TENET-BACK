import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { NFTService } from '../nft/nft.service.js';
import { getTenantId } from '../common/tenant/tenant-context.js';


@Injectable()
export class UpdateService {
  constructor(private readonly nftService: NFTService) {}

  /**
   * Verifica y aplica actualizaciones para credenciales dinámicas
   * 
   * @param credentialId ID del certificado a verificar
   * @returns Update aplicado o null si no hay actualización necesaria
   */
  async checkAndApplyUpdates(credentialId: string): Promise<any | null> {
    const tenantId = getTenantId();
    const certificate = await prisma.certificate.findFirst({
      where: { id: credentialId, tenantId },
      include: {
        template: {
          include: {
            credentialType: true,
          },
        },
        nft: true,
      },
    });

    if (!certificate) {
      throw new Error(`Certificate with id ${credentialId} not found`);
    }

    if (!certificate.updatePolicy) {
      return null; // No es dinámico
    }

    const updatePolicy = certificate.updatePolicy as any;
    const certificateData = certificate.data as any;

    // Obtener datos externos según el trigger
    const externalData = await this.fetchExternalData(updatePolicy.trigger, certificateData);

    // Evaluar reglas de actualización
    const update = this.evaluateUpdateRules(
      certificateData,
      externalData,
      updatePolicy.updateLogic,
    );

    if (!update) {
      return null; // No hay actualización necesaria
    }

    // Aplicar actualización
    return await this.applyUpdate(credentialId, update, updatePolicy);
  }

  /**
   * Aplica una actualización a un credential dinámico
   * 
   * @param credentialId ID del certificado
   * @param update Datos de la actualización
   * @param policy Política de actualización
   * @returns Update registrado
   */
  async applyUpdate(
    credentialId: string,
    update: any,
    policy: any,
  ): Promise<any> {
    const tenantId = getTenantId();
    const certificate = await prisma.certificate.findFirst({
      where: { id: credentialId, tenantId },
      include: { nft: true },
    });

    if (!certificate) {
      throw new Error(`Certificate with id ${credentialId} not found`);
    }

    // Guardar estado anterior
    const previousState = JSON.parse(JSON.stringify(certificate.data));

    // Actualizar credential data
    const updatedData = {
      ...(certificate.data as any),
      ...update,
    };

    await prisma.certificate.update({
      where: { id: credentialId },
      data: { data: updatedData },
    });

    // Si tiene NFT, actualizar metadata en IPFS
    if (certificate.nft) {
      try {
        await this.nftService.updateNFTMetadata(
          certificate.nft.tokenId,
          updatedData,
        );
      } catch (error: any) {
        console.error(`Error updating NFT metadata: ${error.message}`);
        // Continuar aunque falle la actualización de metadata
      }
    }

    // Registrar actualización
    const credentialUpdate = await prisma.credentialUpdate.create({
      data: {
        tenantId,
        credentialId,
        updateType: policy.type,
        updateData: update,
        previousState,
      },
    });

    return credentialUpdate;
  }

  /**
   * Obtiene historial de actualizaciones de un credential
   * 
   * @param credentialId ID del certificado
   * @returns Historial de actualizaciones
   */
  async getUpdateHistory(credentialId: string): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.credentialUpdate.findMany({
      where: { credentialId, tenantId },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /**
   * Programa actualizaciones automáticas (polling)
   * 
   * @param credentialId ID del certificado
   * @param intervalMs Intervalo en milisegundos
   */
  async scheduleAutoUpdates(credentialId: string, intervalMs: number = 30000): Promise<void> {
    // TODO: Implementar con Bull Queue o similar
    // Por ahora, solo registro
    console.log(`Scheduling auto-updates for credential ${credentialId} every ${intervalMs}ms`);
  }

  /**
   * Obtiene datos externos según el trigger configurado
   */
  private async fetchExternalData(trigger: any, certificateData?: any): Promise<any> {
    if (!trigger || !trigger.endpoint) {
      throw new Error('Trigger endpoint not configured');
    }

    try {
      // Reemplazar variables en el endpoint
      let endpoint = trigger.endpoint;
      
      // Reemplazar variables de entorno
      endpoint = endpoint.replace(/\$\{TIMING_API_URL\}/g, process.env.TIMING_API_URL || 'http://localhost:3001');
      
      // Reemplazar variables del certificado
      if (certificateData) {
        endpoint = endpoint.replace(/\$\{eventId\}/g, certificateData.eventId || '');
        endpoint = endpoint.replace(/\$\{participantId\}/g, certificateData.participantId || '');
      }
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch external data: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`Error fetching external data from ${trigger.endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Evalúa las reglas de actualización y determina si hay actualización necesaria
   */
  private evaluateUpdateRules(
    currentData: any,
    externalData: any,
    logic: any,
  ): any | null {
    if (!logic || !logic.rules || !Array.isArray(logic.rules)) {
      return null;
    }

    // Evaluar cada regla en orden
    for (const rule of logic.rules) {
      if (this.evaluateCondition(rule.condition, currentData, externalData)) {
        return rule.action;
      }
    }

    return null;
  }

  /**
   * Evalúa una condición (simplificado)
   * En producción, usar un motor de reglas más robusto como json-rules-engine
   */
  private evaluateCondition(condition: string, current: any, external: any): boolean {
    try {
      // Reemplazar variables en la condición
      // Ejemplo: "external.finishTime < thresholds.gold"
      let evalCondition = condition;

      // Reemplazar referencias a external
      evalCondition = evalCondition.replace(/external\.(\w+)/g, (match, key) => {
        const value = external[key];
        return value !== undefined ? (typeof value === 'number' ? String(value) : JSON.stringify(value)) : 'undefined';
      });

      // Reemplazar referencias a current (incluyendo nested como thresholds.gold)
      evalCondition = evalCondition.replace(/current\.(\w+(?:\.\w+)*)/g, (match, path) => {
        const keys = path.split('.');
        let value: any = current;
        for (const key of keys) {
          value = value?.[key];
          if (value === undefined) break;
        }
        return value !== undefined ? (typeof value === 'number' ? String(value) : JSON.stringify(value)) : 'undefined';
      });

      // Reemplazar referencias directas a thresholds
      if (current.thresholds) {
        evalCondition = evalCondition.replace(/thresholds\.(\w+)/g, (match, key) => {
          const value = current.thresholds[key];
          return value !== undefined ? value : 'undefined';
        });
      }

      // Evaluar condición (simplificado - en producción usar un motor de reglas)
      // Por ahora, solo evaluamos comparaciones simples
      if (evalCondition.includes('<')) {
        const [left, right] = evalCondition.split('<').map(s => s.trim());
        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        if (!isNaN(leftNum) && !isNaN(rightNum)) {
          return leftNum < rightNum;
        }
      }
      if (evalCondition.includes('>')) {
        const [left, right] = evalCondition.split('>').map(s => s.trim());
        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        if (!isNaN(leftNum) && !isNaN(rightNum)) {
          return leftNum > rightNum;
        }
      }
      if (evalCondition.includes('<=')) {
        const [left, right] = evalCondition.split('<=').map(s => s.trim());
        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        if (!isNaN(leftNum) && !isNaN(rightNum)) {
          return leftNum <= rightNum;
        }
      }
      if (evalCondition.includes('>=')) {
        const [left, right] = evalCondition.split('>=').map(s => s.trim());
        const leftNum = parseFloat(left);
        const rightNum = parseFloat(right);
        if (!isNaN(leftNum) && !isNaN(rightNum)) {
          return leftNum >= rightNum;
        }
      }
      if (evalCondition.includes('===') || evalCondition.includes('==')) {
        const [left, right] = evalCondition.split(/===|==/).map(s => s.trim());
        return left === right;
      }

      // Si no se puede evaluar, retornar false
      return false;
    } catch (error) {
      console.error(`Error evaluating condition "${condition}":`, error);
      return false;
    }
  }
}

