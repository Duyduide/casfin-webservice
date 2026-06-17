import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const SYNC_INTERVAL_MS = 60 * 1000; // rate limit: 1 lần/phút per account

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // TODO: gọi Casso bank API để lấy transactions mới kể từ lastSyncedAt
    const bankTransactions: any[] = await this.fetchBankTransactions(account);

    for (const bankTx of bankTransactions) {
      await this.deduplicateAndSave(account, bankTx);
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
  }

  // TODO: implement — gọi Casso bank API với access token của user
  private async fetchBankTransactions(account: any): Promise<any[]> {
    throw new Error('Not implemented — chờ Casso bank API');
  }

  // Two-phase dedup: tìm pending_bank_confirm match → merge, không tìm thấy → tạo mới
  private async deduplicateAndSave(account: any, bankTx: any): Promise<void> {
    // Nếu bankReferenceId đã tồn tại → đã xử lý rồi, skip
    const existing = await this.prisma.transaction.findUnique({
      where: { bankReferenceId: bankTx.referenceId },
    });
    if (existing) return;

    // Tìm pending_bank_confirm transaction khớp (amount + account + time ±5 phút)
    const fiveMinutes = 5 * 60 * 1000;
    const bankDate = new Date(bankTx.date);

    const pending = await this.prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        status: 'pending_bank_confirm',
        amount: bankTx.amount,
        date: {
          gte: new Date(bankDate.getTime() - fiveMinutes),
          lte: new Date(bankDate.getTime() + fiveMinutes),
        },
      },
    });

    if (pending) {
      // Match found → confirm và gắn bankReferenceId
      await this.prisma.transaction.update({
        where: { id: pending.id },
        data: { status: 'confirmed', bankReferenceId: bankTx.referenceId },
      });
    } else {
      // Không có match → giao dịch ngân hàng thuần túy, tạo mới
      await this.prisma.transaction.create({
        data: {
          userId: account.userId,
          accountId: account.id,
          type: bankTx.amount > 0 ? 'income' : 'expense',
          amount: Math.abs(bankTx.amount),
          date: bankDate,
          status: 'confirmed',
          bankReferenceId: bankTx.referenceId,
          note: bankTx.description,
        },
      });
    }
  }
}
