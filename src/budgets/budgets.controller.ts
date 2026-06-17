import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('budgets')
@UseGuards(SessionGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(@CurrentUser() user: SessionUser) {
    return this.budgetsService.findAll(user.id);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.budgetsService.create(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.budgetsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.budgetsService.remove(user.id, id);
  }
}
