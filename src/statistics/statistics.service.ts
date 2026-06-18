import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCashFlow(userId: string, filters: { from: string; to: string; groupBy: string }) {
    const truncUnit = filters.groupBy === 'day' ? 'day' : filters.groupBy === 'week' ? 'week' : 'month';

    const rows = await this.prisma.$queryRaw<Array<{ period: Date; type: string; total: bigint }>>`
      SELECT
        date_trunc(${truncUnit}, date) AS period,
        type,
        SUM(amount)::bigint            AS total
      FROM "transactions"
      WHERE "user_id" = ${userId}
        AND status    = 'confirmed'
        AND type      IN ('income', 'expense')
        AND date      >= ${new Date(filters.from)}
        AND date      <= ${new Date(filters.to)}
      GROUP BY period, type
      ORDER BY period ASC
    `;

    const map = new Map<string, { period: string; income: number; expense: number }>();
    for (const row of rows) {
      const key = row.period.toISOString();
      if (!map.has(key)) map.set(key, { period: key, income: 0, expense: 0 });
      const entry = map.get(key)!;
      if (row.type === 'income') entry.income = Number(row.total);
      else if (row.type === 'expense') entry.expense = Number(row.total);
    }

    return Array.from(map.values());
  }

  // Aggregate expense/income theo category, sort theo amount desc
  async getByCategory(userId: string, filters: { from: string; to: string; type: string }) {
    return this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: filters.type as any,
        status: 'confirmed',
        date: {
          gte: new Date(filters.from),
          lte: new Date(filters.to),
        },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
  }
}
