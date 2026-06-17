import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(
    @CurrentUser() user: SessionUser,
    @Query('accountId') accountId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll(user.id, { accountId, type, from, to, page, limit });
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.transactionsService.create(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.transactionsService.remove(user.id, id);
  }

  // On-demand AI suggest category
  @Post('suggest-category')
  suggestCategory(
    @Body() dto: { description: string; amount: number },
    @CurrentUser() user: SessionUser,
  ) {
    return this.transactionsService.suggestCategory(user.id, dto);
  }
}
