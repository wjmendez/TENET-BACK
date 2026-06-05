import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { prisma } from '../prisma/prisma.js';

function getPeriodKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

@Injectable()
export class QuotaService {
  async assertIssuanceQuota(tenantId: string, count: number) {
    if (count <= 0) {
      return;
    }
    const { plan, period } = await this.getActivePlan(tenantId);
    const quota = plan.monthlyIssuanceQuota;

    await prisma.$transaction(async (tx) => {
      const usage = await tx.quotaUsage.upsert({
        where: { tenantId_period: { tenantId, period } },
        create: { tenantId, period, issuedCount: 0, apiCallsCount: 0, verificationsCount: 0 },
        update: {},
      });

      if (quota > 0 && usage.issuedCount + count > quota) {
        throw new HttpException('Issuance quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }

      await tx.quotaUsage.update({
        where: { tenantId_period: { tenantId, period } },
        data: { issuedCount: { increment: count } },
      });
    });
  }

  async assertApiQuota(tenantId: string) {
    const { plan, period } = await this.getActivePlan(tenantId);
    const quota = plan.monthlyApiCallsQuota;

    await prisma.$transaction(async (tx) => {
      const usage = await tx.quotaUsage.upsert({
        where: { tenantId_period: { tenantId, period } },
        create: { tenantId, period, issuedCount: 0, apiCallsCount: 0, verificationsCount: 0 },
        update: {},
      });

      if (quota > 0 && usage.apiCallsCount + 1 > quota) {
        throw new HttpException('API quota exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }

      await tx.quotaUsage.update({
        where: { tenantId_period: { tenantId, period } },
        data: { apiCallsCount: { increment: 1 } },
      });
    });
  }

  private async getActivePlan(tenantId: string) {
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
        throw new HttpException('Active plan not found', HttpStatus.TOO_MANY_REQUESTS);
    }

    return { plan: tenantPlan.plan, period: getPeriodKey(now) };
  }

  async incrementVerifications(tenantId: string, count = 1) {
    if (count <= 0) {
      return;
    }
    const { period } = await this.getActivePlan(tenantId);

    await prisma.$transaction(async (tx) => {
      await tx.quotaUsage.upsert({
        where: { tenantId_period: { tenantId, period } },
        create: { tenantId, period, issuedCount: 0, apiCallsCount: 0, verificationsCount: 0 },
        update: {},
      });

      await tx.quotaUsage.update({
        where: { tenantId_period: { tenantId, period } },
        data: { verificationsCount: { increment: count } },
      });
    });
  }
}
