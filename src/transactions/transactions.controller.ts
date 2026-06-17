import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { SuggestCategoryDto } from './dto/suggest-category.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('transactions')
@ApiCookieAuth()
@Controller('transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách giao dịch (có phân trang và filter)' })
  @ApiQuery({ name: 'accountId', required: false, description: 'Lọc theo ví' })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense', 'transfer'] })
  @ApiQuery({ name: 'from', required: false, description: 'Từ ngày (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Đến ngày (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang hiện tại, mặc định 1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi mỗi trang, mặc định 20' })
  @ApiResponse({ status: 200, description: 'Danh sách giao dịch' })
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
  @ApiOperation({ summary: 'Tạo giao dịch mới (income / expense / transfer)' })
  @ApiResponse({ status: 201, description: 'Giao dịch đã tạo, kèm budgetAlert nếu vượt Money Pot' })
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: SessionUser) {
    return this.transactionsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật giao dịch' })
  @ApiParam({ name: 'id', description: 'ID giao dịch' })
  @ApiResponse({ status: 200, description: 'Giao dịch đã cập nhật' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.transactionsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa giao dịch' })
  @ApiParam({ name: 'id', description: 'ID giao dịch' })
  @ApiResponse({ status: 200, description: 'Giao dịch đã xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.transactionsService.remove(user.id, id);
  }

  @Post('suggest-category')
  @ApiOperation({ summary: 'Gợi ý danh mục bằng AI (Gemini Flash)' })
  @ApiResponse({
    status: 200,
    description: 'Category được gợi ý',
    schema: { example: { categoryId: 'uuid', categoryName: 'Ăn uống' } },
  })
  suggestCategory(@Body() dto: SuggestCategoryDto, @CurrentUser() user: SessionUser) {
    return this.transactionsService.suggestCategory(user.id, dto);
  }
}
