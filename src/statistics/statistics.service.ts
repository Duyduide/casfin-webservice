import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement — group transactions by day/week/month, tính tổng income/expense
  async getCashFlow(userId: string, filters: { from: string; to: string; groupBy: string }) {
    throw new Error('Not implemented');
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
