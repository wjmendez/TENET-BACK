import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { prisma } from '../common/prisma/prisma.js';

@Injectable()
export class ControlPlanePlansService {
  async listPlans() {
    return prisma.plan.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPlan(data: {
    code: string;
    monthlyIssuanceQuota: number;
    monthlyApiCallsQuota: number;
    rateLimitRps: number;
    features?: Record<string, unknown>;
  }) {
    if (!data.code?.trim()) {
      throw new BadRequestException('code is required');
    }

    return prisma.plan.create({
      data: {
        code: data.code.trim().toUpperCase(),
        monthlyIssuanceQuota: data.monthlyIssuanceQuota,
        monthlyApiCallsQuota: data.monthlyApiCallsQuota,
        rateLimitRps: data.rateLimitRps,
        features: (data.features || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updatePlan(
    planId: string,
    data: {
      monthlyIssuanceQuota?: number;
      monthlyApiCallsQuota?: number;
      rateLimitRps?: number;
      features?: Record<string, unknown>;
      isActive?: boolean;
    },
  ) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return prisma.plan.update({
      where: { id: planId },
      data: {
        ...(data.monthlyIssuanceQuota !== undefined ? { monthlyIssuanceQuota: data.monthlyIssuanceQuota } : {}),
        ...(data.monthlyApiCallsQuota !== undefined ? { monthlyApiCallsQuota: data.monthlyApiCallsQuota } : {}),
        ...(data.rateLimitRps !== undefined ? { rateLimitRps: data.rateLimitRps } : {}),
        ...(data.features !== undefined
          ? { features: data.features as Prisma.InputJsonValue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }
}
