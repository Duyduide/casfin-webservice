import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@Controller('categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: SessionUser, @Query('type') type?: 'income' | 'expense') {
    return this.categoriesService.findAll(user.id, type);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.categoriesService.create(user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: SessionUser) {
    return this.categoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.categoriesService.remove(user.id, id);
  }
}
