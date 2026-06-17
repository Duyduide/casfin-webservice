import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('statistics')
@ApiCookieAuth()
@Controller('statistics')
@UseGuards(SessionGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('cash-flow')
  @ApiOperation({ summary: 'Thống kê dòng tiền theo khoảng thời gian' })
  @ApiQuery({ name: 'from', required: true, description: 'Từ ngày (ISO 8601)', example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: true, description: 'Đến ngày (ISO 8601)', example: '2024-12-31' })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], description: 'Nhóm theo, mặc định month' })
  @ApiResponse({ status: 200, description: 'Dữ liệu thu/chi theo từng kỳ — dùng cho chart' })
  cashFlow(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'month',
  ) {
    return this.statisticsService.getCashFlow(user.id, { from, to, groupBy });
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Xếp hạng thu/chi theo danh mục' })
  @ApiQuery({ name: 'from', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: true, example: '2024-12-31' })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'], description: 'Mặc định expense' })
  @ApiResponse({ status: 200, description: 'Tổng theo category, sắp xếp theo số tiền giảm dần' })
  byCategory(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('type') type: 'income' | 'expense' = 'expense',
  ) {
    return this.statisticsService.getByCategory(user.id, { from, to, type });
  }
}
