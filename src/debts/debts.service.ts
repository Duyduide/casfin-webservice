import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, type?: 'lend' | 'borrow') {
    return this.prisma.debt.findMany({
      where: { userId, ...(type && { type }) },
      include: { payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: any) {
    return this.prisma.debt.create({
      data: { ...dto, userId, remainingAmount: dto.amount },
    });
  }

  update(userId: string, id: string, dto: any) {
    return this.prisma.debt.update({ where: { id, userId }, data: dto });
  }

  remove(userId: string, id: string) {
    return this.prisma.debt.delete({ where: { id, userId } });
  }

  // Ghi nhận payment + giảm remainingAmount trong 1 DB transaction
  async addPayment(userId: string, debtId: string, dto: { amount: number; note?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.debtPayment.create({
        data: { debtId, amount: dto.amount, note: dto.note },
      });
      await tx.debt.update({
        where: { id: debtId, userId },
        data: { remainingAmount: { decrement: dto.amount } },
      });
      return payment;
    });
  }
}
