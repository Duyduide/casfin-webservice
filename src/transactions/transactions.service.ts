import { Injectable } from '@nestjs/common';
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

  findAll(userId: string, filters: any) {
    // TODO: pagination + filter by accountId, type, date range
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });
  }

  // Tạo transaction + atomic balance update + Money Pot check
  async create(userId: string, dto: any) {
    let budgetAlert = null;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({ data: { ...dto, userId } });

      if (dto.type === 'income') {
        await this.accountsService.updateBalance(tx, dto.accountId, Number(dto.amount));
      } else if (dto.type === 'expense') {
        await this.accountsService.updateBalance(tx, dto.accountId, -Number(dto.amount));

        // Check Money Pot
        budgetAlert = await this.budgetsService.checkAndGetAlert(tx, userId, dto.categoryId, dto.amount);
      } else if (dto.type === 'transfer') {
        await this.accountsService.updateBalance(tx, dto.accountId, -Number(dto.amount));
        await this.accountsService.updateBalance(tx, dto.toAccountId, Number(dto.amount));
      }

      return created;
    });

    return { data: transaction, ...(budgetAlert && { budgetAlert }) };
  }

  async update(userId: string, id: string, dto: any) {
    // TODO: implement — reverse old balance delta, apply new delta
    throw new Error('Not implemented');
  }

  async remove(userId: string, id: string) {
    // TODO: implement — reverse balance delta trước khi xóa
    throw new Error('Not implemented');
  }

  suggestCategory(userId: string, dto: { description: string; amount: number }) {
    return this.aiService.suggestCategory(userId, dto.description, dto.amount);
  }
}
