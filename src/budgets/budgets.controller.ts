import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam } from '@nestjs/swagger';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('budgets')
@ApiCookieAuth()
@Controller('budgets')
@UseGuards(SessionGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách Money Pots' })
  @ApiResponse({ status: 200, description: 'Danh sách hũ chi tiêu kèm thông tin category' })
  findAll(@CurrentUser() user: SessionUser) {
    return this.budgetsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo Money Pot mới' })
  @ApiResponse({ status: 201, description: 'Money Pot đã tạo' })
  @ApiResponse({ status: 409, description: 'Đã có Money Pot cho category + period này' })
  create(@Body() dto: CreateBudgetDto, @CurrentUser() user: SessionUser) {
    return this.budgetsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật hạn mức Money Pot' })
  @ApiParam({ name: 'id', description: 'ID Money Pot' })
  @ApiResponse({ status: 200, description: 'Money Pot đã cập nhật' })
  update(@Param('id') id: string, @Body() dto: UpdateBudgetDto, @CurrentUser() user: SessionUser) {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa Money Pot' })
  @ApiParam({ name: 'id', description: 'ID Money Pot' })
  @ApiResponse({ status: 200, description: 'Money Pot đã xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.budgetsService.remove(user.id, id);
  }
}
