import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_CATEGORIES } from '../categories/default-categories.constant';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Tìm hoặc tạo user từ Casso claims
  // Nếu user mới: seed toàn bộ default categories trong cùng DB transaction
  async findOrCreate(cassoSub: string, email: string) {
    const existing = await this.prisma.user.findUnique({ where: { cassoSub } });
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { cassoSub, email } });

      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          ...cat,
          userId: user.id,
          isDefault: true,
        })),
      });

      return user;
    });
  }

  async findByCassoSub(cassoSub: string) {
    return this.prisma.user.findUnique({ where: { cassoSub } });
  }
}
