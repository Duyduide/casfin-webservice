import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, type?: 'income' | 'expense') {
    return this.prisma.category.findMany({
      where: { userId, ...(type && { type }) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  create(userId: string, dto: any) {
    return this.prisma.category.create({ data: { ...dto, userId, isDefault: false } });
  }

  update(userId: string, id: string, dto: any) {
    return this.prisma.category.update({ where: { id, userId }, data: dto });
  }

  remove(userId: string, id: string) {
    return this.prisma.category.delete({ where: { id, userId } });
  }
}
