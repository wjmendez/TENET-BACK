import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'tenant';
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

@Injectable()
export class ControlPlaneTenantsService {
  async listTenants(auth: { tenantId: string; isSuperadmin?: boolean }) {
    if (auth.isSuperadmin) {
      return prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return prisma.tenant.findMany({
      where: { id: auth.tenantId },
    });
  }

  async getTenant(tenantId: string, auth: { tenantId: string; isSuperadmin?: boolean }) {
    if (!auth.isSuperadmin && tenantId !== auth.tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async createTenant(data: {
    name: string;
    slug?: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
    planCode?: string;
    branding?: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      supportEmail?: string;
      subdomain?: string;
      customDomain?: string;
      domainStatus?: 'PENDING' | 'VERIFIED' | 'ACTIVE';
    };
  }) {
    if (!data.name?.trim()) {
      throw new BadRequestException('name is required');
    }

    const baseSlug = slugify(data.slug?.trim() || data.name);
    const tenantSlug = await this.ensureTenantSlug(baseSlug);

    const planCode = data.planCode || 'FREE';
    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    const now = new Date();
    const periodStart = now;
    const periodEnd = addMonths(now, 1);

    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug: tenantSlug,
        status: data.status || 'ACTIVE',
        branding: {
          create: {
            logoUrl: data.branding?.logoUrl || null,
            primaryColor: data.branding?.primaryColor || null,
            secondaryColor: data.branding?.secondaryColor || null,
            supportEmail: data.branding?.supportEmail || null,
            subdomain: data.branding?.subdomain || tenantSlug,
            customDomain: data.branding?.customDomain || null,
            domainStatus: data.branding?.domainStatus || 'PENDING',
          },
        },
      },
    });

    await prisma.tenantPlan.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        periodStart,
        periodEnd,
        status: 'ACTIVE',
      },
    });

    return tenant;
  }

  async updateTenant(
    tenantId: string,
    data: { name?: string; status?: 'ACTIVE' | 'SUSPENDED' | 'DELETED' },
    auth: { tenantId: string; isSuperadmin?: boolean },
  ) {
    if (!auth.isSuperadmin && tenantId !== auth.tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async updateBranding(
    tenantId: string,
    data: {
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      supportEmail?: string;
      subdomain?: string;
      customDomain?: string;
      domainStatus?: 'PENDING' | 'VERIFIED' | 'ACTIVE';
    },
    auth: { tenantId: string; isSuperadmin?: boolean },
  ) {
    if (!auth.isSuperadmin && tenantId !== auth.tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    return prisma.tenantBranding.upsert({
      where: { tenantId },
      update: {
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        secondaryColor: data.secondaryColor ?? null,
        supportEmail: data.supportEmail ?? null,
        subdomain: data.subdomain ?? null,
        customDomain: data.customDomain ?? null,
        domainStatus: data.domainStatus ?? 'PENDING',
      },
      create: {
        tenantId,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        secondaryColor: data.secondaryColor ?? null,
        supportEmail: data.supportEmail ?? null,
        subdomain: data.subdomain ?? null,
        customDomain: data.customDomain ?? null,
        domainStatus: data.domainStatus ?? 'PENDING',
      },
    });
  }

  async deleteTenant(tenantId: string) {
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'DELETED' },
    });
  }

  async getTenantPlan(tenantId: string, auth: { tenantId: string; isSuperadmin?: boolean }) {
    if (!auth.isSuperadmin && tenantId !== auth.tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    const now = new Date();
    const tenantPlan = await prisma.tenantPlan.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        periodStart: { lte: now },
        periodEnd: { gte: now },
      },
      include: { plan: true },
    });

    if (!tenantPlan) {
      throw new NotFoundException('Active plan not found');
    }

    return tenantPlan;
  }

  async assignPlan(
    tenantId: string,
    data: { planCode: string; months?: number },
    auth: { tenantId: string; isSuperadmin?: boolean },
  ) {
    if (!auth.isSuperadmin) {
      throw new ForbiddenException('Superadmin access required');
    }

    const plan = await prisma.plan.findUnique({ where: { code: data.planCode } });
    if (!plan) {
      throw new BadRequestException('Plan not found');
    }

    await prisma.tenantPlan.updateMany({
      where: { tenantId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });

    const now = new Date();
    const periodEnd = addMonths(now, data.months || 1);

    return prisma.tenantPlan.create({
      data: {
        tenantId,
        planId: plan.id,
        periodStart: now,
        periodEnd,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });
  }

  private async ensureTenantSlug(baseSlug: string): Promise<string> {
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await prisma.tenant.findUnique({ where: { slug } });
      if (!existing) {
        return slug;
      }
      const suffix = Math.random().toString(16).slice(2, 6);
      slug = `${baseSlug}-${suffix}`;
    }
    throw new BadRequestException('Unable to allocate tenant slug');
  }
}
