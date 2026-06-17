import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('accounts')
@ApiCookieAuth()
@Controller('accounts')
@UseGuards(SessionGuard)
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách ví của user' })
  @ApiResponse({ status: 200, description: 'Danh sách ví' })
  findAll(@CurrentUser() user: SessionUser) {
    return this.accountsService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo ví mới' })
  @ApiResponse({ status: 201, description: 'Ví đã được tạo' })
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: SessionUser) {
    return this.accountsService.create(user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin ví' })
  @ApiParam({ name: 'id', description: 'ID của ví' })
  @ApiResponse({ status: 200, description: 'Ví đã được cập nhật' })
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() user: SessionUser) {
    return this.accountsService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa ví' })
  @ApiParam({ name: 'id', description: 'ID của ví' })
  @ApiResponse({ status: 200, description: 'Ví đã được xóa' })
  remove(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.remove(user.id, id);
  }

  @Post(':id/link/init')
  @ApiOperation({ summary: 'Khởi tạo liên kết ngân hàng qua BankHub' })
  @ApiParam({ name: 'id', description: 'ID của ví ngân hàng' })
  @ApiResponse({ status: 200, description: 'Link URL để mở CasLink UI' })
  initBankLink(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.initBankLink(user.id, id);
  }

  // Callback từ BankHub sau khi user hoàn tất xác thực — không cần SessionGuard
  @Get('link/callback')
  @UseGuards() // override class-level guard
  @ApiOperation({ summary: 'Callback từ BankHub sau khi link ngân hàng' })
  @ApiQuery({ name: 'publicToken', description: 'Token từ BankHub' })
  @ApiQuery({ name: 'accountId', description: 'ID ví cần lưu accessToken' })
  async bankLinkCallback(
    @Query('publicToken') publicToken: string,
    @Query('accountId') accountId: string,
    @Res() res: Response,
  ) {
    await this.accountsService.completeBankLink(accountId, publicToken);
    const deepLink = this.config.get<string>('MOBILE_DEEP_LINK_SCHEME', 'myapp://auth/callback');
    const redirectUrl = deepLink.includes('?')
      ? `${deepLink}&bankLink=success`
      : `${deepLink.replace('auth/callback', 'accounts/link/success')}`;
    res.redirect(redirectUrl);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Đồng bộ giao dịch ngân hàng thủ công' })
  @ApiParam({ name: 'id', description: 'ID của ví ngân hàng' })
  @ApiResponse({ status: 200, description: 'Sync thành công' })
  @ApiResponse({ status: 429, description: 'Đã sync trong vòng 60 giây, thử lại sau' })
  sync(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.accountsService.manualSync(user.id, id);
  }
}
