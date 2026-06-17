import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionUser } from './session.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Mobile mở URL này trong Expo WebBrowser
  // → backend generate PKCE, lưu session, redirect sang Casso /authorize
  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    const authUrl = await this.authService.buildAuthorizeUrl(req);
    return res.redirect(authUrl);
  }

  // Casso redirect về đây sau login + 2FA (nếu có)
  // → exchange code, lưu token + user vào session, redirect deep link về mobile
  @Get('callback')
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

  // Xóa session local + redirect sang Casso /logout
  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    return this.authService.logout(req, res);
  }

  // Trả về user hiện tại từ session — mobile dùng để check auth state
  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  // Trigger org-switch: khởi động PKCE mới, Casso show org picker
  @Get('switch-org')
  async switchOrg(@Req() req: Request, @Res() res: Response) {
    const authUrl = await this.authService.buildSwitchOrgUrl(req);
    return res.redirect(authUrl);
  }
}
