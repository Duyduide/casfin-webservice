import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { UsersService } from '../users/users.service';
import { SessionUser } from './session.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly oidcDiscovery: OidcDiscoveryService,
    private readonly usersService: UsersService,
  ) {}

  // ── Bước 1: Tạo PKCE + redirect URL sang Casso /authorize ────────────────
  async buildAuthorizeUrl(req: Request): Promise<string> {
    const discovery = await this.oidcDiscovery.getConfig();

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = randomBytes(16).toString('hex');

    // Lưu vào session — cần dùng lại ở callback
    // Session TTL giữ ít nhất 10 phút để 2FA / org-picker flow có đủ thời gian
    (req.session as any).codeVerifier = codeVerifier;
    (req.session as any).state = state;

    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set('client_id', process.env.CLIENT_ID!);
    url.searchParams.set('redirect_uri', process.env.REDIRECT_URI!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email offline_access');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    return url.toString();
  }

  // ── Bước 2: Xử lý callback từ Casso, trả về deep link cho mobile ─────────
  async handleCallback(
    code: string,
    state: string,
    req: Request,
  ): Promise<string> {
    const session = req.session as any;
    const scheme = process.env.MOBILE_DEEP_LINK_SCHEME!;

    // Validate state — chống CSRF
    if (!state || state !== session.state) {
      this.logger.warn('State mismatch in auth callback');
      return `${scheme}?error=invalid_state`;
    }

    const codeVerifier = session.codeVerifier as string | undefined;
    if (!codeVerifier) {
      return `${scheme}?error=missing_verifier`;
    }

    let tokens: Awaited<ReturnType<typeof this.exchangeCode>>;
    try {
      tokens = await this.exchangeCode(code, codeVerifier);
    } catch (err) {
      this.logger.error(`Token exchange failed: ${err.message}`);
      return `${scheme}?error=token_exchange_failed`;
    }

    // Decode payload chỉ để bootstrap session — KHÔNG dùng cho auth decision
    const claims = this.decodeJwtPayload(tokens.id_token);

    // Tạo hoặc tìm user trong DB local; seed default categories nếu user mới
    const dbUser = await this.usersService.findOrCreate(claims.sub, claims.email);

    const sessionUser: SessionUser = {
      id: dbUser.id,                        // DB UUID — dùng cho mọi DB query
      cassoSub: claims.sub,
      email: claims.email,
      orgId: claims.org_id,
      orgKycLevel: claims.org_kyc_level ?? null,
      orgLegalId: claims.org_legal_id ?? null,
      orgName: claims.org_name ?? '',
      orgType: claims.org_type ?? 'PERSONAL',
      orgStatus: claims.org_status ?? 'ACTIVE',
      role: claims.role,
    };

    session.user = sessionUser;
    session.accessToken = tokens.access_token;
    session.refreshToken = tokens.refresh_token;
    session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

    // Xóa PKCE data sau khi dùng xong
    delete session.codeVerifier;
    delete session.state;

    this.logger.log(`User ${dbUser.id} authenticated via Casso SSO`);
    return `${scheme}?success=true`;
  }

  // ── Logout: xóa session local + redirect Casso /logout ───────────────────
  async logout(req: Request, res: Response): Promise<void> {
    const discovery = await this.oidcDiscovery.getConfig();

    req.session.destroy(() => {
      const logoutUrl = new URL(discovery.end_session_endpoint);
      logoutUrl.searchParams.set('redirect_uri', process.env.APP_URL!);
      res.redirect(logoutUrl.toString());
    });
  }

  // ── GET /auth/me — trả user info từ session ───────────────────────────────
  getCurrentUser(req: Request): SessionUser {
    const user = (req.session as any)?.user as SessionUser | null;
    if (!user) throw new UnauthorizedException('Chưa đăng nhập');
    return user;
  }

  // ── Switch org — khởi động lại PKCE flow mới, Casso sẽ show org picker ───
  async buildSwitchOrgUrl(req: Request): Promise<string> {
    return this.buildAuthorizeUrl(req);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async exchangeCode(code: string, codeVerifier: string) {
    const discovery = await this.oidcDiscovery.getConfig();

    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.REDIRECT_URI!,
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Token exchange failed: ${err.code ?? err.message}`);
    }

    return res.json() as Promise<{
      access_token: string;
      id_token: string;
      refresh_token: string;
      expires_in: number;
    }>;
  }

  // Decode JWT payload mà không verify — chỉ dùng để bootstrap session
  // Verification thật sự phải dùng JWKS (xem session.guard.ts hoặc bearer middleware)
  private decodeJwtPayload(token: string): any {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  }
}
