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
  @ApiQuery({ name: 'categoryId', required: false, description: 'Lọc theo danh mục' })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense', 'transfer'] })
  @ApiQuery({ name: 'from', required: false, description: 'Từ ngày (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Đến ngày (ISO 8601)' })
  @ApiQuery({ name: 'page', required: false, description: 'Trang hiện tại, mặc định 1' })
  @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi mỗi trang, mặc định 20' })
  @ApiQuery({
    name: 'availableAsDebtSource',
    required: false,
    enum: ['lend', 'borrow'],
    description: 'Lọc giao dịch Cho vay/Đi vay chưa được gắn vào khoản nợ nào',
  })
  @ApiQuery({
    name: 'availableAsDebtPayment',
    required: false,
    enum: ['lend', 'borrow'],
    description: 'Lọc giao dịch Thu nợ/Trả nợ chưa được ghi nhận thanh toán nào',
  })
  @ApiResponse({ status: 200, description: 'Danh sách giao dịch' })
  findAll(
    @CurrentUser() user: SessionUser,
    @Query('accountId') accountId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('availableAsDebtSource') availableAsDebtSource?: 'lend' | 'borrow',
    @Query('availableAsDebtPayment') availableAsDebtPayment?: 'lend' | 'borrow',
  ) {
    return this.transactionsService.findAll(user.id, {
      accountId, categoryId, type, from, to, page, limit,
      availableAsDebtSource, availableAsDebtPayment,
    });
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

  @Post('classify-uncategorized')
  @ApiOperation({ summary: 'Phân loại hàng loạt các giao dịch chưa có danh mục bằng AI (batch 10)' })
  @ApiResponse({
    status: 200,
    description: 'Kết quả phân loại',
    schema: { example: { processed: 25, classified: 23 } },
  })
  classifyUncategorized(@CurrentUser() user: SessionUser) {
    return this.transactionsService.classifyUncategorized(user.id);
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
