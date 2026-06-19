import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async update(userId: string, id: string, dto: any) {
    const category = await this.prisma.category.findUnique({ where: { id, userId } });
    if (!category) throw new NotFoundException('Category không tồn tại');
    if (category.isDefault) throw new ForbiddenException('Không thể chỉnh sửa danh mục mặc định');
    return this.prisma.category.update({ where: { id, userId }, data: dto });
  }

  async remove(userId: string, id: string) {
    const category = await this.prisma.category.findUnique({ where: { id, userId } });
    if (!category) throw new NotFoundException('Category không tồn tại');
    if (category.isDefault) throw new ForbiddenException('Không thể xóa danh mục mặc định');
    return this.prisma.category.delete({ where: { id, userId } });
  }
}
