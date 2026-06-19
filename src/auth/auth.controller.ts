import { Controller, Get, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionUser } from './session.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @ApiOperation({
    summary: 'Khởi động đăng nhập qua Casso SSO',
    description: 'Mobile mở URL này trong Expo WebBrowser. Backend generate PKCE và redirect sang Casso /authorize.',
  })
  @ApiResponse({ status: 302, description: 'Redirect sang Casso login page' })
  async login(@Req() req: Request, @Res() res: Response) {
    const authUrl = await this.authService.buildAuthorizeUrl(req);
    return res.redirect(authUrl);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Callback từ Casso sau khi login thành công',
    description: 'Casso redirect về đây. Backend exchange code → lưu session → redirect về mobile deep link.',
  })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiResponse({ status: 302, description: 'Redirect về myapp://auth/callback?success=true' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      const redirectUri = this.authService.getRedirectUriForState(state);
      return res.redirect(`${redirectUri}?error=${error}`);
    }
    const deepLink = await this.authService.handleCallback(code, state, req);
    return res.redirect(deepLink);
  }

  @Post('handoff')
  @ApiOperation({
    summary: 'Đổi handoff token lấy session cookie (Android deep link workaround)',
    description: 'Chrome Custom Tab và OkHttp dùng cookie jar riêng trên Android. Endpoint này nhận handoff token từ deep link, tạo session mới cho request OkHttp và trả về Set-Cookie.',
  })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Session created, Set-Cookie returned' })
  @ApiResponse({ status: 401, description: 'Token không hợp lệ hoặc đã hết hạn' })
  async handoff(@Query('token') token: string, @Req() req: Request) {
    const user = await this.authService.exchangeHandoff(token, req);
    if (!user) throw new UnauthorizedException('Invalid or expired handoff token');
    return user;
  }

  @Get('logout')
  @ApiOperation({ summary: 'Đăng xuất — xóa session và redirect sang Casso /logout' })
  @ApiResponse({ status: 302, description: 'Redirect sang Casso logout page' })
  async logout(@Req() req: Request, @Res() res: Response) {
    return this.authService.logout(req, res);
  }

  @Get('heartbeat')
  @UseGuards(SessionGuard)
  @ApiOperation({
    summary: 'Giữ session sống — mobile gọi định kỳ khi app foreground',
    description: 'TokenRefreshMiddleware tự động refresh access token nếu sắp hết hạn. Mobile gọi mỗi 5 phút để đảm bảo token không bị expire khi user không tương tác.',
  })
  @ApiResponse({ status: 200, description: 'Session still alive' })
  heartbeat(@CurrentUser() user: SessionUser) {
    return { ok: true, userId: user.id };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Lấy thông tin user đang đăng nhập từ session' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin user',
    schema: {
      example: {
        id: 'db-uuid',
        cassoSub: 'casso-uuid',
        email: 'user@example.com',
        orgId: 'org-uuid',
        orgName: 'Acme Corp',
        orgType: 'PERSONAL',
        role: 'ADMIN',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Get('switch-org')
  @ApiOperation({ summary: 'Chuyển tổ chức — khởi động PKCE mới, Casso hiện org picker' })
  @ApiResponse({ status: 302, description: 'Redirect sang Casso /authorize' })
  async switchOrg(@Req() req: Request, @Res() res: Response) {
    const authUrl = await this.authService.buildSwitchOrgUrl(req);
    return res.redirect(authUrl);
  }
}
