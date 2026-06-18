import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { UsersService } from '../users/users.service';
import { SessionUser } from './session.types';

interface PkceEntry {
  codeVerifier: string;
  redirectUri: string;
  expiresAt: number;
}

interface HandoffEntry {
  sessionUser: SessionUser;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly pkceStore = new Map<string, PkceEntry>();
  // Handoff store: bridge Chrome Custom Tab session → OkHttp cookie jar (Android)
  private readonly handoffStore = new Map<string, HandoffEntry>();

  constructor(
    private readonly oidcDiscovery: OidcDiscoveryService,
    private readonly usersService: UsersService,
  ) {}

  // ── Bước 1: Tạo PKCE + redirect URL sang Casso /authorize ────────────────
  async buildAuthorizeUrl(req: Request): Promise<string> {
    const discovery = await this.oidcDiscovery.getConfig();

    // Lấy redirectUri từ query param (frontend truyền lên để hỗ trợ Expo Go + standalone)
    const mobileRedirectUri =
      (req.query.redirectUri as string) || process.env.MOBILE_DEEP_LINK_SCHEME!;

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    const state = randomBytes(16).toString('hex');

    // Lưu codeVerifier + redirectUri vào memory keyed by state (TTL 10 phút)
    this.pkceStore.set(state, {
      codeVerifier,
      redirectUri: mobileRedirectUri,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    this.logger.log(`[login] generated state=${state}`);

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

    // Lookup PKCE entry bằng state từ Casso
    const pkceEntry = this.pkceStore.get(state);
    this.pkceStore.delete(state); // single-use

    this.logger.log(`[callback] received state=${state}, found=${!!pkceEntry}`);

    if (!pkceEntry || Date.now() > pkceEntry.expiresAt) {
      this.logger.warn(`PKCE state invalid or expired: state=${state}`);
      const fallback = process.env.MOBILE_DEEP_LINK_SCHEME!;
      return `${fallback}?error=invalid_state`;
    }

    const redirectBase = pkceEntry.redirectUri;

    let tokens: Awaited<ReturnType<typeof this.exchangeCode>>;
    try {
      tokens = await this.exchangeCode(code, pkceEntry.codeVerifier);
    } catch (err) {
      this.logger.error(`Token exchange failed: ${err.message}`);
      return `${redirectBase}?error=token_exchange_failed`;
    }

    // Decode payload chỉ để bootstrap session — KHÔNG dùng cho auth decision
    const claims = this.decodeJwtPayload(tokens.id_token);

    // Tạo hoặc tìm user trong DB local; seed default categories nếu user mới
    const dbUser = await this.usersService.findOrCreate(claims.sub, claims.email);

    const sessionUser: SessionUser = {
      id: dbUser.id,
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

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    // Tạo handoff token để bridge cookie jar giữa Chrome Custom Tab và OkHttp (Android)
    const handoffToken = randomBytes(16).toString('hex');
    this.handoffStore.set(handoffToken, {
      sessionUser,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      expiresAt: Date.now() + 60_000, // TTL 60 giây
    });

    this.logger.log(`User ${dbUser.id} authenticated via Casso SSO`);
    return `${redirectBase}?handoffToken=${handoffToken}`;
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

  // ── Đổi handoff token lấy session (Android: bridge Chrome ↔ OkHttp cookie) ─
  async exchangeHandoff(token: string, req: Request): Promise<SessionUser | null> {
    const entry = this.handoffStore.get(token);
    this.handoffStore.delete(token); // single-use

    if (!entry || Date.now() > entry.expiresAt) {
      this.logger.warn(`Handoff token invalid or expired: ${token}`);
      return null;
    }

    // Tạo session mới cho request này (OkHttp) — express-session sẽ set Set-Cookie
    const session = req.session as any;
    session.user = entry.sessionUser;
    session.accessToken = entry.accessToken;
    session.refreshToken = entry.refreshToken;
    session.tokenExpiresAt = entry.tokenExpiresAt;

    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    this.logger.log(`Handoff exchanged for user ${entry.sessionUser.id}`);
    return entry.sessionUser;
  }

  // ── Lấy redirectUri đã lưu cho state (dùng khi Casso trả về lỗi sớm) ────
  getRedirectUriForState(state: string): string {
    return this.pkceStore.get(state)?.redirectUri ?? process.env.MOBILE_DEEP_LINK_SCHEME!;
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

  private decodeJwtPayload(token: string): any {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  }
}
