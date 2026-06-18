import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BankhubService } from '../bankhub/bankhub.service';
import { SyncService } from '../sync/sync.service';

const SYNC_RATE_LIMIT_MS = 60 * 1000;

@Injectable()
export class BankConnectionsService {
  private readonly logger = new Logger(BankConnectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bankhubService: BankhubService,
    private readonly syncService: SyncService,
    private readonly config: ConfigService,
  ) {}

  async startBankLink(userId: string): Promise<{ linkUrl: string; linkToken: string }> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // TTL 10 phút
    const tokenRecord = await this.prisma.bankLinkToken.create({
      data: { userId, expiresAt },
    });

    // redirectUri phải khớp CHÍNH XÁC với URL đã đăng ký trên BankHub portal
    const redirectUri = this.config.getOrThrow<string>('APP_URL');
    const { linkUrl } = await this.bankhubService.createGrantToken(redirectUri);

    this.logger.log(`Bank link started for user ${userId}`);
    return { linkUrl, linkToken: tokenRecord.token };
  }

  async completeBankLink(publicToken: string, linkToken: string): Promise<void> {
    // 1. Validate linkToken
    const tokenRecord = await this.prisma.bankLinkToken.findUnique({ where: { token: linkToken } });
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired link token');
    }
    const { userId } = tokenRecord;

    // 2. Exchange publicToken → accessToken
    const { accessToken } = await this.bankhubService.exchangePublicToken(publicToken);

    // 3. Fetch bank data: fiService + bankAccounts + transactions (một lần duy nhất)
    const syncResult = await this.bankhubService.fetchTransactions(accessToken);

    // 4. Tạo BankConnection
    const connection = await this.prisma.bankConnection.create({
      data: {
        userId,
        accessToken,
        bankCode: syncResult.fiService.code,
        bankName: syncResult.fiService.name,
        bankLogoUrl: syncResult.fiService.logo,
        maxHistoryDays: syncResult.fiService.maxHistoryDays,
        lastSyncedAt: new Date(),
      },
    });

    // 5. Tạo một Account cho mỗi bank account trả về
    const accounts = await this.prisma.account.createManyAndReturn({
      data: syncResult.bankAccounts.map((ba) => ({
        userId,
        name: `${syncResult.fiService.name} - ${ba.accountNumber}`,
        type: 'bank' as const,
        balance: ba.balance,
        currency: ba.currency,
        bankConnectionId: connection.id,
        accountNumber: ba.accountNumber,
        accountHolderName: ba.accountName,
      })),
    });

    // 6. Lưu lịch sử giao dịch ban đầu (accounts mới tạo nên skip dedup)
    const accountMap = new Map(accounts.map((a) => [a.accountNumber, a]));
    const txData = syncResult.transactions
      .map((t) => {
        const account = accountMap.get(t.accountNumber);
        if (!account) return null;
        const bankDate = new Date(t.transactionDateTime);
        return {
          userId,
          accountId: account.id,
          type: (t.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
          amount: Math.abs(t.amount),
          date: bankDate,
          status: 'confirmed' as const,
          bankReferenceId: t.referenceId,
          note: t.description,
          transactionDateTime: bankDate,
          runningBalance: t.runningBalance,
          counterAccountName: t.counterAccountName,
          counterAccountBankName: t.counterAccountBankName,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    if (txData.length > 0) {
      await this.prisma.transaction.createMany({ data: txData, skipDuplicates: true });
    }

    // 7. Xóa token đã dùng
    await this.prisma.bankLinkToken.delete({ where: { id: tokenRecord.id } });

    this.logger.log(
      `Bank link completed for user ${userId}: ${accounts.length} accounts, ${txData.length} transactions`,
    );
  }

  async manualSync(
    userId: string,
    connectionId: string,
    dateRange?: { fromDate?: string; toDate?: string },
  ): Promise<{ message: string }> {
    const connection = await this.prisma.bankConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.userId !== userId) {
      throw new NotFoundException('Bank connection not found');
    }

    const hasDateRange = !!(dateRange?.fromDate || dateRange?.toDate);

    if (!hasDateRange && connection.lastSyncedAt) {
      const elapsed = Date.now() - connection.lastSyncedAt.getTime();
      if (elapsed < SYNC_RATE_LIMIT_MS) {
        const retryAfter = Math.ceil((SYNC_RATE_LIMIT_MS - elapsed) / 1000);
        throw new HttpException(`Đã sync gần đây. Thử lại sau ${retryAfter}s`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    await this.syncService.syncConnection(
      connectionId,
      hasDateRange
        ? {
            fromDate: dateRange?.fromDate ? new Date(dateRange.fromDate) : undefined,
            toDate: dateRange?.toDate ? new Date(dateRange.toDate) : undefined,
            force: true,
          }
        : undefined,
    );
    return { message: 'Sync completed' };
  }

  findAll(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      include: { accounts: true },
    });
  }
}
