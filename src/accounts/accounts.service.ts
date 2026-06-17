import { Injectable, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { BankhubService } from '../bankhub/bankhub.service';

const SYNC_RATE_LIMIT_MS = 60 * 1000;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
    private readonly bankhubService: BankhubService,
    private readonly config: ConfigService,
  ) {}

  findAll(userId: string) {
    return this.prisma.account.findMany({ where: { userId } });
  }

  create(userId: string, dto: any) {
    return this.prisma.account.create({ data: { ...dto, userId } });
  }

  update(userId: string, id: string, dto: any) {
    return this.prisma.account.update({ where: { id, userId }, data: dto });
  }

  remove(userId: string, id: string) {
    return this.prisma.account.delete({ where: { id, userId } });
  }

  async manualSync(userId: string, accountId: string) {
    const account = await this.prisma.account.findUnique({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Account not found');

    if (account.lastSyncedAt) {
      const elapsed = Date.now() - account.lastSyncedAt.getTime();
      if (elapsed < SYNC_RATE_LIMIT_MS) {
        const retryAfter = Math.ceil((SYNC_RATE_LIMIT_MS - elapsed) / 1000);
        throw new HttpException(`Đã sync gần đây. Thử lại sau ${retryAfter}s`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    await this.syncService.syncAccount(accountId);
    return { message: 'Sync completed' };
  }

  async initBankLink(userId: string, accountId: string): Promise<{ linkUrl: string }> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Account not found');
    if (account.type !== 'bank' && account.type !== 'e_wallet') {
      throw new HttpException('Chỉ tài khoản ngân hàng hoặc ví điện tử mới cần liên kết', HttpStatus.BAD_REQUEST);
    }

    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const redirectUri = `${appUrl}/api/accounts/link/callback?accountId=${accountId}`;
    const { linkUrl } = await this.bankhubService.createGrantToken(redirectUri);
    return { linkUrl };
  }

  async completeBankLink(accountId: string, publicToken: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');

    const { accessToken } = await this.bankhubService.exchangePublicToken(publicToken);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { bankhubAccessToken: accessToken },
    });
  }

  updateBalance(
    tx: Prisma.TransactionClient,
    accountId: string,
    delta: number,
  ) {
    return tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
  }
}
