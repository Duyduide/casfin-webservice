import { Injectable, Logger } from '@nestjs/common';

export interface OidcConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint: string;
  issuer: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

@Injectable()
export class OidcDiscoveryService {
  private readonly logger = new Logger(OidcDiscoveryService.name);
  private config: OidcConfig | null = null;
  private cachedAt = 0;

  async getConfig(): Promise<OidcConfig> {
    if (this.config && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.config;
    }

    try {
      const res = await fetch(
        `${process.env.CASSO_BASE_URL}/.well-known/openid-configuration`,
      );
      if (!res.ok) throw new Error(`Discovery returned ${res.status}`);

      this.config = await res.json();
      this.cachedAt = Date.now();
      this.logger.log('OIDC discovery refreshed');
      return this.config!;
    } catch (err) {
      this.logger.warn(`OIDC discovery failed: ${err.message} — using fallback`);
      // Fallback về deterministic endpoints nếu provider tạm unavailable
      if (this.config) return this.config;
      return this.buildFallback();
    }
  }

  private buildFallback(): OidcConfig {
    const base = process.env.CASSO_BASE_URL!;
    return {
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      userinfo_endpoint: `${base}/userinfo`,
      jwks_uri: `${base}/jwks`,
      end_session_endpoint: `${base}/logout`,
      issuer: base,
    };
  }
}
