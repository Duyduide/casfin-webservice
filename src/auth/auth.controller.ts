import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
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
      const scheme = process.env.MOBILE_DEEP_LINK_SCHEME!;
      return res.redirect(`${scheme}?error=${error}`);
    }
    const deepLink = await this.authService.handleCallback(code, state, req);
    return res.redirect(deepLink);
  }

  @Get('logout')
  @ApiOperation({ summary: 'Đăng xuất — xóa session và redirect sang Casso /logout' })
  @ApiResponse({ status: 302, description: 'Redirect sang Casso logout page' })
  async logout(@Req() req: Request, @Res() res: Response) {
    return this.authService.logout(req, res);
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
