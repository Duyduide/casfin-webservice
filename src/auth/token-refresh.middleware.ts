import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OidcDiscoveryService } from './oidc-discovery.service';

// Per-session mutex: tránh race condition khi nhiều request cùng lúc refresh token
// Key = sessionID, Value = Promise đang chạy
const refreshLocks = new Map<string, Promise<void>>();

async function withRefreshLock(sessionId: string, fn: () => Promise<void>) {
  const existing = refreshLocks.get(sessionId) ?? Promise.resolve();
  const next = existing.then(fn).finally(() => {
    if (refreshLocks.get(sessionId) === next) refreshLocks.delete(sessionId);
  });
  refreshLocks.set(sessionId, next);
  return next;
}

@Injectable()
export class TokenRefreshMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TokenRefreshMiddleware.name);

  constructor(private readonly oidcDiscovery: OidcDiscoveryService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const session = req.session as any;

    if (!session.refreshToken) return next();

    const expiresIn = (session.tokenExpiresAt as number) - Date.now();
    // Threshold 7 phút: token mới (10 phút) không bị refresh ngay; heartbeat mỗi 5 phút sẽ
    // trigger refresh khi còn ~5 phút, nằm trong buffer này.
    if (expiresIn > 7 * 60 * 1000) return next();

    await withRefreshLock(req.sessionID, async () => {
      // Double-check sau khi acquire lock: có thể request khác đã refresh rồi
      if ((session.tokenExpiresAt as number) > Date.now() + 60_000) return;

      try {
        const tokens = await this.doRefresh(session.refreshToken);
        session.accessToken = tokens.access_token;
        // Refresh token được rotate mỗi lần — lưu ngay token mới
        session.refreshToken = tokens.refresh_token ?? session.refreshToken;
        session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
        // Persist ngay vào DB — không chờ res.end() để tránh race condition
        await new Promise<void>((resolve, reject) =>
          req.session.save((err) => (err ? reject(err) : resolve())),
        );
        this.logger.log(`Token refreshed for session ${req.sessionID}`);
      } catch (err) {
        this.logger.warn(`Token refresh failed: ${err.message}`);
      }
    });

    next();
  }

  private async doRefresh(refreshToken: string) {
    const discovery = await this.oidcDiscovery.getConfig();

    const res = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID!,
        client_secret: process.env.CLIENT_SECRET!,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Refresh failed: ${err.code ?? err.message}`);
    }

    return res.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    }>;
  }
}
