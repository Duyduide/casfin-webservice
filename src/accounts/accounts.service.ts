import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

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

  // TODO: implement — check rate limit 60s, gọi Casso bank API, chạy dedup logic
  async manualSync(userId: string, accountId: string) {
    throw new Error('Not implemented');
  }

  // Atomic balance update — luôn dùng trong prisma.$transaction()
  updateBalance(
    tx: Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
    accountId: string,
    delta: number, // dương = cộng, âm = trừ
  ) {
    return tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
  }
}
