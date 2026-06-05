import { Injectable } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { getTenantId } from '../common/tenant/tenant-context.js';


@Injectable()
export class VerticalService {
  /**
   * Crea una nueva vertical
   */
  async createVertical(data: {
    name: string;
    slug: string;
    description?: string;
    config?: any;
    isActive?: boolean;
  }): Promise<any> {
    const tenantId = getTenantId();
    return prisma.vertical.create({
      data: {
        tenantId,
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        config: data.config || {},
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  /**
   * Obtiene una vertical por slug
   */
  async getVertical(slug: string): Promise<any> {
    const tenantId = getTenantId();
    return prisma.vertical.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      include: {
        credentialTypes: {
          where: { isActive: true },
        },
        issuers: true,
        templates: true,
      },
    });
  }

  /**
   * Obtiene una vertical por ID
   */
  async getVerticalById(id: string): Promise<any> {
    const tenantId = getTenantId();
    return prisma.vertical.findFirst({
      where: { id, tenantId },
      include: {
        credentialTypes: {
          where: { isActive: true },
        },
        issuers: true,
        templates: true,
      },
    });
  }

  /**
   * Lista todas las verticales activas
   */
  async listActiveVerticals(): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.vertical.findMany({
      where: { tenantId, isActive: true },
      include: {
        credentialTypes: {
          where: { isActive: true },
        },
        _count: {
          select: {
            issuers: true,
            templates: true,
            bundles: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Lista todas las verticales (incluyendo inactivas)
   */
  async listAllVerticals(): Promise<any[]> {
    const tenantId = getTenantId();
    return prisma.vertical.findMany({
      where: { tenantId },
      include: {
        credentialTypes: {
          where: { isActive: true },
        },
        _count: {
          select: {
            issuers: true,
            templates: true,
            bundles: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Actualiza la configuración de una vertical
   */
  async updateVerticalConfig(id: string, config: any): Promise<any> {
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({ where: { id, tenantId } });
    if (!vertical) {
      throw new Error(`Vertical with id ${id} not found`);
    }

    return prisma.vertical.update({
      where: { id },
      data: {
        config: {
          ...(vertical.config as any),
          ...config,
        },
      },
    });
  }

  /**
   * Activa o desactiva una vertical
   */
  async setActive(id: string, isActive: boolean): Promise<any> {
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({ where: { id, tenantId } });
    if (!vertical) {
      throw new Error(`Vertical with id ${id} not found`);
    }
    return prisma.vertical.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Elimina una vertical (soft delete - solo desactiva)
   */
  async deleteVertical(id: string): Promise<any> {
    return this.setActive(id, false);
  }

  /**
   * Verifica si una vertical tiene una feature específica habilitada
   * @param verticalId ID de la vertical
   * @param feature Nombre de la feature (ej: 'bundle', 'smart-medal', 'nft')
   * @returns true si la feature está habilitada
   */
  async hasFeature(verticalId: string, feature: string): Promise<boolean> {
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({
      where: { id: verticalId, tenantId },
    });

    if (!vertical || !vertical.isActive) {
      return false;
    }

    const config = vertical.config as any;
    const features = config?.features || [];
    return Array.isArray(features) && features.includes(feature);
  }

  /**
   * Verifica si una vertical tiene una feature específica habilitada (por slug)
   * @param slug Slug de la vertical
   * @param feature Nombre de la feature (ej: 'bundle', 'smart-medal', 'nft')
   * @returns Vertical si tiene la feature, null si no
   */
  async getVerticalWithFeature(slug: string, feature: string): Promise<any> {
    const tenantId = getTenantId();
    const vertical = await prisma.vertical.findFirst({
      where: { slug, tenantId },
    });

    if (!vertical || !vertical.isActive) {
      return null;
    }

    const config = vertical.config as any;
    const features = config?.features || [];
    const hasFeature = Array.isArray(features) && features.includes(feature);

    if (!hasFeature) {
      return null;
    }

    return vertical;
  }
}

