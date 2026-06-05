import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from '../common/prisma/prisma.js';

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

@Injectable()
export class ControlPlaneUsersService {
  async listUsers(tenantId: string) {
    return prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listMemberships(tenantId: string) {
    return prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: { id: true, email: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(tenantId: string, data: { email: string; password?: string; name?: string; role?: string }) {
    const email = data.email?.toLowerCase().trim();
    if (!email) {
      throw new BadRequestException('email is required');
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      if (!data.password) {
        throw new BadRequestException('password is required for new users');
      }
      user = await prisma.user.create({
        data: {
          email,
          name: data.name || null,
          passwordHash: hashPassword(data.password),
        },
      });
    } else if (data.password && !user.passwordHash) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(data.password) },
      });
    }

    const role = data.role || 'ADMIN';
    const membership = await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
      create: {
        tenantId,
        userId: user.id,
        role,
      },
      update: {
        role,
      },
    });

    return { user, membership };
  }

  async updateUser(
    userId: string,
    tenantId: string,
    data: { name?: string; status?: 'ACTIVE' | 'BLOCKED' },
    isSuperadmin?: boolean,
  ) {
    if (!isSuperadmin) {
      const membership = await prisma.membership.findFirst({ where: { userId, tenantId } });
      if (!membership) {
        throw new ForbiddenException('User access denied');
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  async updateMembershipRole(
    membershipId: string,
    tenantId: string,
    role: string,
    isSuperadmin?: boolean,
  ) {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (!isSuperadmin && membership.tenantId !== tenantId) {
      throw new ForbiddenException('Membership access denied');
    }

    return prisma.membership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  async deleteMembership(membershipId: string, tenantId: string, isSuperadmin?: boolean) {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (!isSuperadmin && membership.tenantId !== tenantId) {
      throw new ForbiddenException('Membership access denied');
    }

    await prisma.membership.delete({ where: { id: membershipId } });
    return { status: 'deleted' };
  }
}
