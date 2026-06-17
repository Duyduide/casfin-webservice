import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('debts')
@UseGuards(SessionGuard)
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  findAll(@CurrentUser() user: SessionUser, @Query('type') type?: 'lend' | 'borrow') {
    return this.debtsService.findAll(user.id, type);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.debtsService.create(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.debtsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.debtsService.remove(user.id, id);
  }

  // Ghi nhận 1 lần trả/đòi nợ (partial hoặc full)
  @Post(':id/payments')
  addPayment(
    @Param('id') id: string,
    @Body() dto: { amount: number; note?: string },
    @CurrentUser() user: SessionUser,
  ) {
    return this.debtsService.addPayment(user.id, id, dto);
  }
}
