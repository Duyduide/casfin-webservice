import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BankhubService, BankTx } from '../bankhub/bankhub.service';

const SYNC_INTERVAL_MS = 60 * 1000; // rate limit: 1 lần/phút per account

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankhubService: BankhubService,
  ) {}

  // Chạy mỗi 4 tiếng — iterate tất cả bank/e_wallet accounts, gọi Casso API tuần tự
  @Cron('0 */4 * * *')
  async syncAllAccounts() {
    this.logger.log('Bank sync cron started');

    const accounts = await this.prisma.account.findMany({
      where: { type: { in: ['bank', 'e_wallet'] } },
    });

    for (const account of accounts) {
      try {
        await this.syncAccount(account.id);
      } catch (err) {
        this.logger.error(`Sync failed for account ${account.id}: ${err.message}`);
      }
    }

    this.logger.log(`Bank sync cron done — ${accounts.length} accounts processed`);
  }

  // Dùng cho cả cron và manual sync từ AccountsController
  async syncAccount(accountId: string): Promise<void> {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: accountId } });

    // Enforce rate limit: skip nếu đã sync trong vòng 60s
    if (account.lastSyncedAt) {
      const elapsed = Date.now() - account.lastSyncedAt.getTime();
      if (elapsed < SYNC_INTERVAL_MS) {
        this.logger.warn(`Account ${accountId} synced ${elapsed}ms ago — skipping`);
        return;
      }
    }

    const bankTransactions = await this.fetchBankTransactions(account);

    for (const bankTx of bankTransactions) {
      await this.deduplicateAndSave(account, bankTx);
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
  }

  private async fetchBankTransactions(account: { id: string; bankhubAccessToken: string | null; lastSyncedAt: Date | null }): Promise<BankTx[]> {
    if (!account.bankhubAccessToken) {
      this.logger.warn(`Account ${account.id} has no BankHub access token — skipping fetch`);
      return [];
    }
    try {
      return await this.bankhubService.fetchTransactions(
        account.bankhubAccessToken,
        account.lastSyncedAt ?? undefined,
      );
    } catch (err) {
      this.logger.error(`BankHub fetch failed for account ${account.id}: ${(err as Error).message}`);
      return [];
    }
  }

  // Two-phase dedup: tìm pending_bank_confirm match → merge, không tìm thấy → tạo mới + update balance
  private async deduplicateAndSave(account: any, bankTx: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { bankReferenceId: bankTx.referenceId },
      });
      if (existing) return;

      const fiveMinutes = 5 * 60 * 1000;
      const bankDate = new Date(bankTx.date);
      const bankAmount = Math.abs(bankTx.amount);
      const txType = bankTx.amount >= 0 ? 'income' : 'expense';
      const balanceDelta = bankTx.amount >= 0 ? bankAmount : -bankAmount;

      const pending = await tx.transaction.findFirst({
        where: {
          accountId: account.id,
          status: 'pending_bank_confirm',
          amount: bankAmount,
          date: {
            gte: new Date(bankDate.getTime() - fiveMinutes),
            lte: new Date(bankDate.getTime() + fiveMinutes),
          },
        },
      });

      if (pending) {
        // Match → confirm, balance đã được update khi user tạo pending tx
        await tx.transaction.update({
          where: { id: pending.id },
          data: { status: 'confirmed', bankReferenceId: bankTx.referenceId },
        });
      } else {
        // Giao dịch ngân hàng thuần túy → tạo mới + cập nhật balance
        await tx.transaction.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            type: txType,
            amount: bankAmount,
            date: bankDate,
            status: 'confirmed',
            bankReferenceId: bankTx.referenceId,
            note: bankTx.description,
          },
        });
        await tx.account.update({
          where: { id: account.id },
          data: { balance: { increment: balanceDelta } },
        });
      }
    });
  }
}
