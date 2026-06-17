import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('categories')
@ApiCookieAuth()
@Controller('categories')
@UseGuards(SessionGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách category của user' })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'], description: 'Lọc theo loại' })
  @ApiResponse({ status: 200, description: 'Danh sách category (default trước, rồi custom)' })
  findAll(@CurrentUser() user: SessionUser, @Query('type') type?: 'income' | 'expense') {
    return this.categoriesService.findAll(user.id, type);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo category tùy chỉnh' })
  @ApiResponse({ status: 201, description: 'Category đã tạo' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: SessionUser) {
    return this.categoriesService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật category' })
  @ApiParam({ name: 'id', description: 'ID category' })
  @ApiResponse({ status: 200, description: 'Category đã cập nhật' })
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: SessionUser) {
    return this.categoriesService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa category' })
  @ApiParam({ name: 'id', description: 'ID category' })
  @ApiResponse({ status: 200, description: 'Category đã xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.categoriesService.remove(user.id, id);
  }
}
