import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../common/prisma/prisma.js';
import { getTenantIdOptional } from '../common/tenant/tenant-context.js';

const STATUS_LIST_CONTEXTS = [
  'https://www.w3.org/2018/credentials/v1',
  'https://w3id.org/vc/status-list/2021/v1',
];

function base64UrlEncode(input: Uint8Array): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64');
}

function buildEmptyEncodedList(listSize: number): string {
  const byteLength = Math.ceil(listSize / 8);
  const buffer = Buffer.alloc(byteLength, 0);
  return base64UrlEncode(buffer);
}

function setBit(encodedList: string, index: number, value: boolean): string {
  const buffer = base64UrlDecode(encodedList);
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  if (byteIndex >= buffer.length) {
    return encodedList;
  }
  const mask = 1 << bitIndex;
  const current = buffer[byteIndex] || 0;
  buffer[byteIndex] = value ? (current | mask) : (current & ~mask);
  return base64UrlEncode(buffer);
}

@Injectable()
export class StatusListService {
  async getStatusListCredential(statusListId: string) {
    const tenantId = getTenantIdOptional();
    const statusList = await prisma.statusList.findFirst({
      where: { id: statusListId, ...(tenantId ? { tenantId } : {}) },
      include: { issuer: { select: { did: true } } },
    });

    if (!statusList) {
      throw new NotFoundException('Status list not found');
    }

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const credentialId = `${baseUrl}/.well-known/status/${statusList.id}`;

    return {
      '@context': STATUS_LIST_CONTEXTS,
      id: credentialId,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: statusList.issuer.did,
      issuanceDate: statusList.updatedAt.toISOString(),
      credentialSubject: {
        id: credentialId,
        type: 'StatusList2021',
        statusPurpose: statusList.statusPurpose,
        encodedList: statusList.encodedList,
      },
    };
  }

  async allocateEntry(issuerId: string, statusPurpose: string, listSize: number) {
    const statusList = await prisma.statusList.findFirst({
      where: {
        issuerId,
        statusPurpose,
        nextIndex: { lt: listSize },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!statusList) {
      const created = await prisma.statusList.create({
        data: {
          tenantId: await this.getIssuerTenantId(issuerId),
          issuerId,
          statusPurpose,
          encodedList: buildEmptyEncodedList(listSize),
          listSize,
          nextIndex: 0,
        },
      });
      return this.incrementAndReturnIndex(created.id);
    }

    return this.incrementAndReturnIndex(statusList.id);
  }

  async updateEntry(statusListId: string, index: number, value: boolean) {
    const statusList = await prisma.statusList.findUnique({ where: { id: statusListId } });
    if (!statusList) {
      throw new NotFoundException('Status list not found');
    }

    const encodedList = setBit(statusList.encodedList, index, value);
    return prisma.statusList.update({
      where: { id: statusListId },
      data: { encodedList },
    });
  }

  private async incrementAndReturnIndex(statusListId: string) {
    const updated = await prisma.statusList.update({
      where: { id: statusListId },
      data: { nextIndex: { increment: 1 } },
      select: { id: true, nextIndex: true },
    });
    return { statusListId: updated.id, statusListIndex: updated.nextIndex - 1 };
  }

  private async getIssuerTenantId(issuerId: string): Promise<string> {
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      select: { tenantId: true },
    });
    if (!issuer) {
      throw new NotFoundException('Issuer not found');
    }
    return issuer.tenantId;
  }
}
