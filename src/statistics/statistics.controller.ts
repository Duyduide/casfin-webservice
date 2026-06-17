import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('statistics')
@UseGuards(SessionGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  // Tổng thu/chi theo khoảng thời gian — dùng cho chart dòng tiền
  @Get('cash-flow')
  cashFlow(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'month',
  ) {
    return this.statisticsService.getCashFlow(user.id, { from, to, groupBy });
  }

  // Xếp hạng chi tiêu theo category trong kỳ
  @Get('by-category')
  byCategory(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('type') type: 'income' | 'expense' = 'expense',
  ) {
    return this.statisticsService.getByCategory(user.id, { from, to, type });
  }
}
