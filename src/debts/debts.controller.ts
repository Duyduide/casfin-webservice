import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('debts')
@ApiCookieAuth()
@Controller('debts')
@UseGuards(SessionGuard)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nợ' })
  @ApiQuery({ name: 'type', required: false, enum: ['lend', 'borrow'], description: 'lend = mình cho vay, borrow = mình đi vay' })
  @ApiResponse({ status: 200, description: 'Danh sách khoản nợ kèm lịch sử thanh toán' })
  findAll(@CurrentUser() user: SessionUser, @Query('type') type?: 'lend' | 'borrow') {
    return this.debtsService.findAll(user.id, type);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo khoản nợ mới' })
  @ApiResponse({ status: 201, description: 'Khoản nợ đã tạo' })
  create(@Body() dto: CreateDebtDto, @CurrentUser() user: SessionUser) {
    return this.debtsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật khoản nợ' })
  @ApiParam({ name: 'id', description: 'ID khoản nợ' })
  @ApiResponse({ status: 200, description: 'Khoản nợ đã cập nhật' })
  update(@Param('id') id: string, @Body() dto: UpdateDebtDto, @CurrentUser() user: SessionUser) {
    return this.debtsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khoản nợ' })
  @ApiParam({ name: 'id', description: 'ID khoản nợ' })
  @ApiResponse({ status: 200, description: 'Khoản nợ đã xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.debtsService.remove(user.id, id);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Ghi nhận thanh toán (partial hoặc full)' })
  @ApiParam({ name: 'id', description: 'ID khoản nợ' })
  @ApiResponse({ status: 201, description: 'Thanh toán đã ghi nhận, remainingAmount đã cập nhật' })
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.debtsService.addPayment(user.id, id, dto);
  }
}
