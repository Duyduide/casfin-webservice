import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  updateBalance(tx: Prisma.TransactionClient, accountId: string, delta: number) {
    return tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
  }
}
