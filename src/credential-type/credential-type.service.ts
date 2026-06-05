import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { getTenantId } from '../common/tenant/tenant-context.js';


@Injectable()
export class CredentialTypeService {
  /**
   * Crea un nuevo tipo de credencial
   */
  async createType(verticalId: string, data: {
    name: string;
    type: string; // VC_STATIC, VC_DYNAMIC, NFT_STATIC, NFT_DYNAMIC, BUNDLE
    schema?: any;
    displayConfig?: any;
    updatePolicy?: any;
    isActive?: boolean;
  }): Promise<any> {
    const tenantId = getTenantId();
    // Verificar que la vertical existe
    const vertical = await prisma.vertical.findFirst({ where: { id: verticalId, tenantId } });
    if (!vertical) {
      throw new Error(`Vertical with id ${verticalId} not found`);
    }

    return prisma.credentialType.create({
      data: {
        tenantId,
        verticalId,
        name: data.name,
        type: data.type,
        schema: data.schema || null,
        displayConfig: data.displayConfig || null,
        updatePolicy: data.updatePolicy || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  /**
   * Obtiene un tipo de credencial por ID
   */
  async getType(id: string): Promise<any> {
    const tenantId = getTenantId();
    return prisma.credentialType.findFirst({
      where: { id, tenantId },
      include: {
        vertical: true,
        templates: true,
      },
    });
  }

  /**
   * Lista tipos de credenciales por vertical
   */
  async listTypesByVertical(verticalId: string, includeInactive: boolean = false): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.credentialType.findMany({
      where: {
        tenantId,
        verticalId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        vertical: true,
        _count: {
          select: {
            templates: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Lista todos los tipos de credenciales
   */
  async listAllTypes(includeInactive: boolean = false): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.credentialType.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        vertical: true,
        _count: {
          select: {
            templates: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Valida un credential contra el schema del tipo
   */
  async validateCredential(typeId: string, credential: any): Promise<boolean> {
    const type = await this.getType(typeId);
    if (!type) {
      throw new Error(`CredentialType with id ${typeId} not found`);
    }

    // Si no hay schema, no validar
    if (!type.schema) {
      return true;
    }

    // Validación básica con JSON Schema
    // En producción, usar una librería como Ajv
    try {
      // Por ahora, validación simplificada
      // TODO: Implementar validación completa con Ajv
      return true;
    } catch (error) {
      console.error('Error validating credential:', error);
      return false;
    }
  }

  /**
   * Actualiza un tipo de credencial
   */
  async updateType(id: string, data: {
    name?: string;
    schema?: any;
    displayConfig?: any;
    updatePolicy?: any;
    isActive?: boolean;
  }): Promise<any> {
    const tenantId = getTenantId();
    const existing = await prisma.credentialType.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error(`CredentialType with id ${id} not found`);
    }
    return prisma.credentialType.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.schema !== undefined && { schema: data.schema }),
        ...(data.displayConfig !== undefined && { displayConfig: data.displayConfig }),
        ...(data.updatePolicy !== undefined && { updatePolicy: data.updatePolicy }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Elimina un tipo de credencial (soft delete)
   */
  async deleteType(id: string): Promise<any> {
    const tenantId = getTenantId();
    const existing = await prisma.credentialType.findFirst({ where: { id, tenantId } });
    if (!existing) {
      throw new Error(`CredentialType with id ${id} not found`);
    }
    return prisma.credentialType.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

