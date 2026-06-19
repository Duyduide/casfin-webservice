import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DebtType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateDebtDto } from './dto/create-debt.dto';

@Injectable()
export class DebtsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, type?: 'lend' | 'borrow') {
    return this.prisma.debt.findMany({
      where: { userId, ...(type && { type }) },
      include: {
        transactions: { include: { category: true } },
        payments: { include: { transaction: { include: { category: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateDebtDto) {
    const { transactionIds, type, contactName, note, dueDate } = dto;

    // Fetch tất cả transactions được chọn, kèm category
    const transactions = await this.prisma.transaction.findMany({
      where: { id: { in: transactionIds }, userId },
      include: { category: true },
    });

    // Kiểm tra đủ số lượng
    if (transactions.length !== transactionIds.length) {
      throw new NotFoundException('Một hoặc nhiều giao dịch không tồn tại hoặc không thuộc về bạn');
    }

    // Kiểm tra tất cả phải là debt-related category
    const invalidCategory = transactions.find((tx) => !tx.category?.isDebtRelated);
    if (invalidCategory) {
      throw new BadRequestException(
        'Tất cả giao dịch phải thuộc danh mục sổ nợ (Cho vay / Đi vay)',
      );
    }

    // Kiểm tra category.type khớp với debt.type
    // lend (cho vay) → transaction phải là expense (tiền ra)
    // borrow (đi vay) → transaction phải là income (tiền vào)
    const expectedTxType = type === DebtType.lend ? 'expense' : 'income';
    const typeMismatch = transactions.find((tx) => tx.category?.type !== expectedTxType);
    if (typeMismatch) {
      const expected = type === DebtType.lend ? '"Cho vay" (chi tiêu)' : '"Đi vay" (thu nhập)';
      throw new BadRequestException(
        `Khoản nợ loại "${type}" yêu cầu giao dịch danh mục ${expected}`,
      );
    }

    // Kiểm tra chưa được link vào debt khác
    const alreadyLinked = transactions.find((tx) => tx.debtId !== null);
    if (alreadyLinked) {
      throw new BadRequestException('Một hoặc nhiều giao dịch đã được gắn vào khoản nợ khác');
    }

    const amount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    return this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.create({
        data: { userId, contactName, type, amount, remainingAmount: amount, note, dueDate },
      });

      await tx.transaction.updateMany({
        where: { id: { in: transactionIds } },
        data: { debtId: debt.id },
      });

      return tx.debt.findUnique({
        where: { id: debt.id },
        include: {
          transactions: { include: { category: true } },
          payments: true,
        },
      });
    });
  }

  update(userId: string, id: string, dto: any) {
    return this.prisma.debt.update({ where: { id, userId }, data: dto });
  }

  remove(userId: string, id: string) {
    // Transaction.debtId dùng onDelete: SetNull → Prisma tự unlink khi xóa debt
    return this.prisma.debt.delete({ where: { id, userId } });
  }

  async addPayment(userId: string, debtId: string, dto: AddPaymentDto) {
    // Fetch debt để xác nhận ownership và lấy type
    const debt = await this.prisma.debt.findUnique({ where: { id: debtId, userId } });
    if (!debt) throw new NotFoundException('Khoản nợ không tồn tại');

    // Fetch transaction kèm category
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId, userId },
      include: { category: true },
    });
    if (!transaction) throw new NotFoundException('Giao dịch không tồn tại hoặc không thuộc về bạn');

    // Phải là debt-related category
    if (!transaction.category?.isDebtRelated) {
      throw new BadRequestException('Giao dịch phải thuộc danh mục sổ nợ (Thu nợ / Trả nợ)');
    }

    // Kiểm tra category.type khớp với debt.type (logic ngược với lúc tạo nợ)
    // lend (cho vay) → payment phải là income "Thu nợ" (tiền thu về)
    // borrow (đi vay) → payment phải là expense "Trả nợ" (tiền trả ra)
    const expectedTxType = debt.type === DebtType.lend ? 'income' : 'expense';
    if (transaction.category?.type !== expectedTxType) {
      const expected = debt.type === DebtType.lend ? '"Thu nợ" (thu nhập)' : '"Trả nợ" (chi tiêu)';
      throw new BadRequestException(
        `Khoản nợ loại "${debt.type}" yêu cầu giao dịch danh mục ${expected}`,
      );
    }

    // Kiểm tra transaction chưa được dùng làm payment
    const existingPayment = await this.prisma.debtPayment.findUnique({
      where: { transactionId: dto.transactionId },
    });
    if (existingPayment) {
      throw new BadRequestException('Giao dịch này đã được ghi nhận cho một khoản thanh toán khác');
    }

    const paymentAmount = Number(transaction.amount);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.debtPayment.create({
        data: {
          debtId,
          amount: paymentAmount,
          note: dto.note,
          transactionId: dto.transactionId,
        },
        include: { transaction: { include: { category: true } } },
      });

      await tx.debt.update({
        where: { id: debtId },
        data: { remainingAmount: { decrement: paymentAmount } },
      });

      return payment;
    });
  }
}
