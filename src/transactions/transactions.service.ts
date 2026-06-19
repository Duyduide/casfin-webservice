import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from '../accounts/accounts.service';
import { BudgetsService } from '../budgets/budgets.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
    private readonly budgetsService: BudgetsService,
    private readonly aiService: AiService,
  ) {}

  async findAll(
    userId: string,
    filters: {
      accountId?: string;
      categoryId?: string;
      type?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = Math.max(1, parseInt(filters.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit ?? '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.accountId && { accountId: filters.accountId }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.type && { type: filters.type as any }),
      ...((filters.from || filters.to) && {
        date: {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { category: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, dto: any) {
    if (!dto.categoryId && dto.note && dto.type !== 'transfer') {
      try {
        const suggestion = await this.aiService.suggestCategory(
          userId,
          dto.note,
          dto.amount,
          dto.type,
        );
        if (suggestion?.categoryId) {
          dto = { ...dto, categoryId: suggestion.categoryId };
        }
      } catch {
        // AI failed — proceed without category
      }
    }

    let budgetAlert: Awaited<ReturnType<BudgetsService['checkAndGetAlert']>> | null = null;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({ data: { ...dto, userId } });

      if (dto.type === 'income') {
        await this.accountsService.updateBalance(tx, dto.accountId, Number(dto.amount));
      } else if (dto.type === 'expense') {
        await this.accountsService.updateBalance(tx, dto.accountId, -Number(dto.amount));
        budgetAlert = await this.budgetsService.checkAndGetAlert(tx, userId, dto.categoryId, dto.amount);
      } else if (dto.type === 'transfer') {
        await this.accountsService.updateBalance(tx, dto.accountId, -Number(dto.amount));
        await this.accountsService.updateBalance(tx, dto.toAccountId, Number(dto.amount));
      }

      return created;
    });

    if (budgetAlert) {
      return { data: transaction, budgetAlert };
    }
    return { data: transaction };
  }

  async update(userId: string, id: string, dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Transaction not found');

      // Nếu amount thay đổi → điều chỉnh balance (delta = phần chênh lệch)
      if (dto.amount !== undefined) {
        const oldAmount = Number(existing.amount);
        const newAmount = Number(dto.amount);
        const delta = newAmount - oldAmount;

        if (delta !== 0) {
          if (existing.type === 'income') {
            await this.accountsService.updateBalance(tx, existing.accountId, delta);
          } else if (existing.type === 'expense') {
            await this.accountsService.updateBalance(tx, existing.accountId, -delta);
          } else if (existing.type === 'transfer') {
            await this.accountsService.updateBalance(tx, existing.accountId, -delta);
            await this.accountsService.updateBalance(tx, existing.toAccountId!, delta);
          }
        }
      }

      return tx.transaction.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Transaction not found');

      const amount = Number(existing.amount);

      if (existing.type === 'income') {
        await this.accountsService.updateBalance(tx, existing.accountId, -amount);
      } else if (existing.type === 'expense') {
        await this.accountsService.updateBalance(tx, existing.accountId, amount);
      } else if (existing.type === 'transfer') {
        await this.accountsService.updateBalance(tx, existing.accountId, amount);
        await this.accountsService.updateBalance(tx, existing.toAccountId!, -amount);
      }

      return tx.transaction.delete({ where: { id } });
    });
  }

  async classifyUncategorized(userId: string): Promise<{ processed: number; classified: number }> {
    const uncategorized = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: null,
        note: { not: null },
        type: { not: 'transfer' as any },
      },
      select: { id: true, note: true, amount: true, type: true },
    });

    const processed = uncategorized.length;
    let classified = 0;

    const BATCH_SIZE = 10;
    for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
      const batch = uncategorized.slice(i, i + BATCH_SIZE);
      const input = batch.map((tx) => ({
        id: tx.id,
        note: tx.note!,
        amount: Number(tx.amount),
        type: tx.type as 'income' | 'expense',
      }));

      const suggestions = await this.aiService.batchSuggestCategories(userId, input);
      const toUpdate = suggestions.filter((s) => s.categoryId !== null);

      if (toUpdate.length > 0) {
        await this.prisma.$transaction(
          toUpdate.map((s) =>
            this.prisma.transaction.update({
              where: { id: s.transactionId },
              data: { categoryId: s.categoryId },
            }),
          ),
        );
        classified += toUpdate.length;
      }
    }

    return { processed, classified };
  }

  suggestCategory(userId: string, dto: { description: string; amount: number; type?: 'income' | 'expense' }) {
    return this.aiService.suggestCategory(userId, dto.description, dto.amount, dto.type);
  }
}
