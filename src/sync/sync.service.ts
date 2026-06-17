import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BankhubService, BankTx } from '../bankhub/bankhub.service';

const SYNC_INTERVAL_MS = 60 * 1000; // rate limit: 1 lần/phút per connection

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankhubService: BankhubService,
  ) {}

  @Cron('0 */4 * * *')
  async syncAllConnections() {
    this.logger.log('Bank sync cron started');

    const connections = await this.prisma.bankConnection.findMany();

    for (const connection of connections) {
      try {
        await this.syncConnection(connection.id);
      } catch (err) {
        this.logger.error(`Sync failed for connection ${connection.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`Bank sync cron done — ${connections.length} connections processed`);
  }

  async syncConnection(connectionId: string): Promise<void> {
    const connection = await this.prisma.bankConnection.findUniqueOrThrow({ where: { id: connectionId } });

    if (connection.lastSyncedAt) {
      const elapsed = Date.now() - connection.lastSyncedAt.getTime();
      if (elapsed < SYNC_INTERVAL_MS) {
        this.logger.warn(`Connection ${connectionId} synced ${elapsed}ms ago — skipping`);
        return;
      }
    }

    let syncResult;
    try {
      syncResult = await this.bankhubService.fetchTransactions(
        connection.accessToken,
        connection.lastSyncedAt ?? undefined,
      );
    } catch (err) {
      this.logger.error(`BankHub fetch failed for connection ${connectionId}: ${(err as Error).message}`);
      return;
    }

    const accounts = await this.prisma.account.findMany({
      where: { bankConnectionId: connectionId },
    });
    const accountMap = new Map(accounts.map((a) => [a.accountNumber, a]));

    for (const bankTx of syncResult.transactions) {
      const account = accountMap.get(bankTx.accountNumber);
      if (!account) {
        this.logger.warn(`No account for accountNumber ${bankTx.accountNumber} in connection ${connectionId}`);
        continue;
      }
      await this.deduplicateAndSave(account, bankTx);
    }

    await this.prisma.bankConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });
  }

  private async deduplicateAndSave(
    account: { id: string; userId: string; accountNumber: string | null },
    bankTx: BankTx,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { bankReferenceId: bankTx.referenceId },
      });
      if (existing) return;

      const fiveMinutes = 5 * 60 * 1000;
      const bankDate = new Date(bankTx.transactionDateTime);
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
        // Match → confirm; balance đã được update khi user tạo pending tx
        await tx.transaction.update({
          where: { id: pending.id },
          data: {
            status: 'confirmed',
            bankReferenceId: bankTx.referenceId,
            transactionDateTime: bankDate,
            runningBalance: bankTx.runningBalance,
            counterAccountName: bankTx.counterAccountName,
            counterAccountBankName: bankTx.counterAccountBankName,
          },
        });
      } else {
        // Giao dịch thuần từ ngân hàng → tạo mới + cập nhật balance
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
            transactionDateTime: bankDate,
            runningBalance: bankTx.runningBalance,
            counterAccountName: bankTx.counterAccountName,
            counterAccountBankName: bankTx.counterAccountBankName,
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
