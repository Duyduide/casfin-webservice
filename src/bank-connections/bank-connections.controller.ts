import { Controller, Get, Post, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { BankConnectionsService } from './bank-connections.service';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/session.types';

@ApiTags('bank-connections')
@ApiCookieAuth()
@Controller('bank-connections')
@UseGuards(SessionGuard)
export class BankConnectionsController {
  constructor(
    private readonly bankConnectionsService: BankConnectionsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách bank connections của user (kèm accounts)' })
  @ApiResponse({ status: 200, description: 'Danh sách bank connections' })
  findAll(@CurrentUser() user: SessionUser) {
    return this.bankConnectionsService.findAll(user.id);
  }

  @Post('start')
  @ApiOperation({ summary: 'Bước 1+2: Khởi tạo liên kết ngân hàng — trả về CasLink URL' })
  @ApiResponse({ status: 201, description: '{ linkUrl } để mở CasLink UI' })
  async startBankLink(@CurrentUser() user: SessionUser, @Req() req: Request) {
    const { linkUrl, linkToken } = await this.bankConnectionsService.startBankLink(user.id);
    // Lưu linkToken vào session để callback đọc lại (tránh truyền qua URL)
    req.session['bankLinkToken'] = linkToken;
    return { linkUrl };
  }

  @Get('callback')
  @UseGuards() // override class-level guard — BankHub redirect về đây (browser có session cookie)
  @ApiOperation({ summary: 'Bước 3+4: Callback từ BankHub — exchange token, tạo accounts, lưu transactions' })
  @ApiQuery({ name: 'publicToken', description: 'Token từ BankHub sau khi user hoàn tất CasLink' })
  @ApiResponse({ status: 302, description: 'Redirect về mobile deep link' })
  async bankLinkCallback(
    @Query('publicToken') publicToken: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const scheme = this.config.get<string>('MOBILE_DEEP_LINK_SCHEME', 'myapp://auth/callback');
    const base = scheme.replace('auth/callback', 'accounts/bank-link');
    const linkToken = req.session['bankLinkToken'] as string | undefined;
    try {
      if (!linkToken) throw new Error('No pending bank link session found');
      await this.bankConnectionsService.completeBankLink(publicToken, linkToken);
      delete req.session['bankLinkToken'];
      // Khi test trên browser, redirect về API list thay vì deep link
      res.redirect('/api/bank-connections');
    } catch (err) {
      res.redirect(`${base}/error?error=${encodeURIComponent((err as Error).message)}`);
    }
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Sync thủ công giao dịch cho một bank connection' })
  @ApiParam({ name: 'id', description: 'ID của bank connection' })
  @ApiResponse({ status: 200, description: 'Sync thành công' })
  @ApiResponse({ status: 429, description: 'Đã sync trong vòng 60 giây, thử lại sau' })
  sync(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.bankConnectionsService.manualSync(user.id, id);
  }
}
