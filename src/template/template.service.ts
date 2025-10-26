import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class TemplateService {
  async create(data: any) {
    return prisma.template.create({ data: { ...data } });
  }

  async findAll() {
    return prisma.template.findMany();
  }

  async findOne(id: string) {
    return prisma.template.findUnique({ where: { id } });
  }

  async remove(id: string) {
    return prisma.template.delete({ where: { id } });
  }
}
