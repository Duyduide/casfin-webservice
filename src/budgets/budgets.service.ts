import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      include: { category: true },
    });

    if (budgets.length === 0) return [];

    const now = new Date();

    return Promise.all(
      budgets.map(async (budget) => {
        const periodStart = this.getPeriodStart(budget.period, now);

        const { _sum } = await this.prisma.transaction.aggregate({
          where: {
            userId,
            categoryId: budget.categoryId,
            type: 'expense',
            status: 'confirmed',
            date: { gte: periodStart },
          },
          _sum: { amount: true },
        });

        return {
          ...budget,
          usedAmount: String(Number(_sum.amount ?? 0)),
        };
      }),
    );
  }

  create(userId: string, dto: any) {
    return this.prisma.budget.create({ data: { ...dto, userId } });
  }

  update(userId: string, id: string, dto: any) {
    return this.prisma.budget.update({ where: { id, userId }, data: dto });
  }

  remove(userId: string, id: string) {
    return this.prisma.budget.delete({ where: { id, userId } });
  }

  // Gọi trong TransactionsService khi tạo expense — trả về alert nếu vượt budget
  async checkAndGetAlert(
    tx: Prisma.TransactionClient,
    userId: string,
    categoryId: string,
    amount: number,
  ) {
    if (!categoryId) return null;

    const budget = await tx.budget.findFirst({
      where: { userId, categoryId },
    });
    if (!budget) return null;

    // Tính tổng chi tiêu trong kỳ hiện tại
    const now = new Date();
    const periodStart = this.getPeriodStart(budget.period, now);

    const { _sum } = await tx.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'expense',
        status: 'confirmed',
        date: { gte: periodStart },
      },
      _sum: { amount: true },
    });

    const used = Number(_sum.amount ?? 0) + amount;
    const limit = Number(budget.limitAmount);

    if (used <= limit) return null;

    return {
      potId: budget.id,
      limitAmount: limit,
      usedAmount: used,
      exceededBy: used - limit,
    };
  }

  private getPeriodStart(period: string, now: Date): Date {
    const d = new Date(now);
    if (period === 'weekly') {
      d.setDate(d.getDate() - d.getDay());
    } else if (period === 'monthly') {
      d.setDate(1);
    } else {
      d.setMonth(0, 1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
