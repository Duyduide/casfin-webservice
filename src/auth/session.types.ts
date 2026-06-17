import 'express-session';

export interface SessionUser {
  id: string;         // DB UUID (primary key của bảng users)
  cassoSub: string;   // UUID từ Casso (claim `sub`)
  email: string;
  orgId: string;
  orgKycLevel: number | null;
  orgLegalId: string | null;
  orgName: string;
  orgType: string;
  orgStatus: string;
  role: string;
}

declare module 'express-session' {
  interface SessionData {
    user: SessionUser | null;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: number;
    // PKCE — xóa sau khi callback xử lý xong
    codeVerifier: string;
    state: string;
    // BankHub link flow — xóa sau khi callback xử lý xong
    bankhubPendingAccountId: string;
    bankhubPendingUserId: string;
  }
}
