# Casso Accounts Integration Guide

How to integrate Casso Accounts OIDC into a Node.js/Express application. This guide is based on the demo app in `be/` and `fe/`, but it also documents the production integration patterns from the main Casso Accounts backend.

## Overview

Casso Accounts is an OpenID Connect (OIDC) provider that handles authentication for Casso products. A complete integration should cover:

- **Authorization Code + PKCE** for browser login
- **JWT verification via JWKS** for Bearer-token APIs
- **Server-side sessions** for browser apps
- **Organization-aware claims** (`org_id`, `org_kyc_level`, `role`)
- **Entitlements** to control which users can access your app
- **Transparent 2FA** handled by Casso during `/authorize`
- **Webhook events** for membership, entitlement, and verification changes

## Prerequisites

- A Casso Accounts instance (self-hosted or managed)
- An OIDC client registered in Casso: `CLIENT_ID` + `CLIENT_SECRET`
- `REDIRECT_URI` allowlisted (for example `http://localhost:3000/auth/callback`)
- Users entitled to your app before login if you enforce app access via entitlements

---

## 1. Discover OIDC Endpoints

Fetch `/.well-known/openid-configuration` at startup instead of hardcoding provider URLs. The demo caches discovery for 5 minutes and falls back to deterministic endpoints when discovery is temporarily unavailable.

```ts
const res = await fetch(`${CASSO_BASE_URL}/.well-known/openid-configuration`);
const discovery = await res.json();

// discovery.authorization_endpoint
// discovery.token_endpoint
// discovery.userinfo_endpoint
// discovery.jwks_uri
// discovery.end_session_endpoint
```

**OIDC endpoint reference**


| Endpoint       | Path                                | Method | Description                         |
| -------------- | ----------------------------------- | ------ | ----------------------------------- |
| Discovery      | `/.well-known/openid-configuration` | GET    | Provider metadata                   |
| Authorization  | `/authorize`                        | GET    | Start login / org switch / 2FA flow |
| Token          | `/token`                            | POST   | Exchange code or refresh tokens     |
| Userinfo       | `/userinfo`                         | GET    | User profile from access token      |
| JWKS           | `/jwks`                             | GET    | Public keys for JWT verification    |
| Logout         | `/logout`                           | GET    | Browser logout                      |
| Revoke Session | `/revoke-session`                   | POST   | Programmatic session revocation     |


See `be/src/oidc/oidc-discovery.ts`.

---

## 2. Initiate Login (PKCE)

Generate a PKCE verifier and challenge, then store both `codeVerifier` and `state` in the server-side session before redirecting to Casso.

```ts
const codeVerifier = crypto.randomBytes(32).toString("base64url");
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

req.session.codeVerifier = codeVerifier;
req.session.state = state;

const url = new URL(discovery.authorization_endpoint);
url.searchParams.set("client_id", CLIENT_ID);
url.searchParams.set("redirect_uri", REDIRECT_URI);
url.searchParams.set("response_type", "code");
url.searchParams.set("scope", "openid email offline_access");
url.searchParams.set("state", state);
url.searchParams.set("code_challenge", codeChallenge);
url.searchParams.set("code_challenge_method", "S256");

res.redirect(url.toString());
```

**Supported scopes**

- `openid` - required
- `email` - include email in tokens
- `profile` - accepted but currently adds no additional claims
- `offline_access` - request a refresh token

> **Never** use `response_type=token` (implicit flow). PKCE with `response_type=code` is required.

---

## 3. Handle the Callback

Your callback receives an authorization code only after Casso has completed login, org selection, and any required 2FA step.

```ts
app.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`/login?error=${error}`);
  }
  if (state !== req.session.state) {
    return res.redirect("/login?error=invalid_state");
  }

  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res.redirect("/login?error=missing_verifier");
  }

  const tokens = await exchangeCodeForTokens(code, codeVerifier);

  // Decode for display/session bootstrap only - not for API auth decisions
  const claims = decodeTokenPayload(tokens.id_token);

  req.session.user = {
    id: claims.sub,
    email: claims.email,
    orgId: claims.org_id,
    orgKycLevel: claims.org_kyc_level ?? null,
    orgLegalId: claims.org_legal_id ?? null,
    orgName: claims.org_name ?? "",
    orgType: claims.org_type ?? "PERSONAL",
    orgStatus: claims.org_status ?? "ACTIVE",
    role: claims.role,
  };
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;
  req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;

  delete req.session.codeVerifier;
  delete req.session.state;

  res.redirect(APP_URL);
});
```

See `be/src/routes/auth-routes.ts`.

---

## 4. Exchange Code for Tokens

Centralize token exchange logic so callback errors are handled consistently.

```ts
async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const discovery = await getOIDCConfig();
  const res = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw Object.assign(
      new Error(`Token exchange failed: ${err.code ?? err.message}`),
      { tokenErrorCode: err.code },
    );
  }

  return res.json() as Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
}
```

**Token response**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "rt_abc123..."
}
```

See `be/src/oidc/oidc-client.ts`.

---

## 5. Session Store

Use a persistent session store such as MySQL or Redis. Do **not** use the default in-memory store in production.

```ts
import MySQLStore from "express-mysql-session";

const SessionStore = MySQLStore(session);

app.use(
  session({
    secret: SESSION_SECRET,
    store: new SessionStore({
      host,
      port,
      database,
      user,
      password,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    },
  }),
);
```

**Important notes**

- `sameSite: "lax"` protects state-changing requests without breaking the OIDC redirect flow.
- Keep your session TTL for `state` / `codeVerifier` at **10 minutes or more**. 2FA, signup, and org-picker flows can extend the time before the user returns to your callback.

---

## 6. Verify Access Token (JWKS)

If your API accepts Bearer tokens, **verify every token** using JWKS. Decoding JWT payloads is only acceptable for display or server-side session bootstrap after the provider already authenticated the user.

The demo middleware uses discovery + cached JWKS like this:

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUri: string | null = null;

async function getJWKS() {
  const discovery = await getOIDCConfig();
  if (!jwks || cachedJwksUri !== discovery.jwks_uri) {
    cachedJwksUri = discovery.jwks_uri;
    jwks = createRemoteJWKSet(new URL(discovery.jwks_uri), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });
  }
  return jwks;
}

export async function requireBearerToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ code: "MISSING_TOKEN" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const discovery = await getOIDCConfig();
    const { payload } = await jwtVerify(token, await getJWKS(), {
      issuer: discovery.issuer,
      audience: CLIENT_ID,
      algorithms: ["RS256"],
    });

    req.tokenUser = {
      sub: payload.sub as string,
      email: payload["email"] as string,
      orgId: payload["org_id"] as string,
      orgKycLevel: (payload["org_kyc_level"] as number | null) ?? null,
      orgLegalId: (payload["org_legal_id"] as string | null) ?? null,
      orgName: payload["org_name"] as string,
      orgType: payload["org_type"] as string,
      orgStatus: payload["org_status"] as string,
      role: payload["role"] as string,
    };

    next();
  } catch (err) {
    res
      .status(401)
      .json({ code: "INVALID_TOKEN", message: (err as Error).message });
  }
}
```

**Verification checklist**

- Validate `issuer`
- Validate `audience: CLIENT_ID`
- Restrict accepted algorithms to `RS256`
- Use JWKS, never an app-shared HS256 secret

See `be/src/middleware/require-bearer-token.ts`.

---

## 6b. Userinfo Endpoint

For cases where you need fresh user data without issuing new tokens, call `/userinfo` with the current access token:

```ts
const res = await fetch(`${CASSO_BASE_URL}/userinfo`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const userinfo = await res.json();
```

**Response**

```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "org_id": "org-id-456",
  "org_kyc_level": 1,
  "org_legal_id": "0123456789",
  "org_name": "Acme Corp",
  "org_type": "BUSINESS",
  "org_status": "ACTIVE",
  "role": "ADMIN"
}
```


| Field           | Type            | Description                                         |
| --------------- | --------------- | --------------------------------------------------- |
| `sub`           | `string`        | User UUID                                           |
| `email`         | `string`        | User email                                          |
| `org_id`        | `string`        | Organization UUID                                   |
| `org_kyc_level` | `number | null` | KYC verification level — `null` or `0` = unverified |
| `org_legal_id`  | `string | null` | Org legal/tax ID — only set after KYC complete      |
| `org_name`      | `string`        | Organization display name                           |
| `org_type`      | `string`        | `BUSINESS` or `PERSONAL`                            |
| `org_status`    | `string`        | `ACTIVE`, `INACTIVE`, or `SUSPENDED`                |
| `role`          | `string`        | User's role in the org: `ADMIN` or `MEMBER`         |


> `/userinfo` always reflects the current state from the database, unlike the JWT which is a snapshot taken at login time. Use it for security-sensitive checks (e.g. org status before a payment operation).

---

## 7. Auto-Refresh Access Token

Access tokens expire in **15 minutes**. Refresh them shortly before expiry and protect refresh logic with a per-session mutex to avoid race conditions.

```ts
app.use(async (req, _res, next) => {
  if (!req.session.refreshToken) return next();

  const expiresIn = req.session.tokenExpiresAt - Date.now();
  if (expiresIn > 5 * 60 * 1000) return next();

  await withRefreshLock(req.sessionID, async () => {
    if (req.session.tokenExpiresAt > Date.now() + 60_000) return;

    const tokens = await refreshTokens(req.session.refreshToken);
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiresAt = Date.now() + tokens.expires_in * 1000;
  });

  next();
});
```

> **Refresh tokens are rotated on every refresh.** Always store the new `refresh_token` returned by the token endpoint immediately.

Mount this middleware before protected routes. See `be/src/lib/token-refresh-lock.ts`.

---

## 8. JWT Claims and KYC

Casso access tokens and ID tokens include these app-useful claims:


| Claim           | Type            | Description                                 |
| --------------- | --------------- | ------------------------------------------- |
| `sub`           | `string`        | User ID                                     |
| `email`         | `string`        | User email                                  |
| `org_id`        | `string`        | Active organization ID                      |
| `org_kyc_level` | `number | null` | Org verification level                      |
| `org_legal_id`  | `string | null` | Legal / tax identifier after KYC            |
| `org_name`      | `string`        | Organization display name                   |
| `org_type`      | `string`        | `BUSINESS` or `PERSONAL`                    |
| `org_status`    | `string`        | `ACTIVE`, `INACTIVE`, or `SUSPENDED`        |
| `role`          | `string`        | User's role in the org: `ADMIN` or `MEMBER` |
| `aud`           | `string`        | Your `CLIENT_ID`                            |
| `scope`         | `string`        | Granted scopes                              |


**KYC levels**


| Level         | Status     | Meaning                            |
| ------------- | ---------- | ---------------------------------- |
| `null` or `0` | Unverified | Org exists but is not KYC-verified |
| `1`           | Verified   | Basic KYC complete                 |
| `2+`          | Enhanced   | Reserved for future KYC tiers      |


**Integration guidance**

- Gate premium or regulated features in backend middleware, not only in frontend UI.
- New orgs created through signup start as unverified.
- Token claims are a **snapshot at login time**. If an org becomes verified later, the user should log out and log in again to receive updated claims.
- **Staleness warning:** `org_status` in a JWT reflects the org's state at token issuance. If an org is suspended after a token is minted, the token still says `ACTIVE` until it expires (up to 15 min). For security-sensitive operations (payments, data export), verify org status server-side via `/userinfo` or your own DB rather than trusting the JWT claim alone.
- `org_type` can drive UI differences (e.g., business orgs show invoicing features).
- `org_name` is useful for display in headers/navigation without an extra API call.

Example KYC gate:

```ts
function requireVerifiedOrg(req, res, next) {
  const kycLevel = req.session.user?.orgKycLevel;
  if (!kycLevel || kycLevel <= 0) {
    return res.status(403).json({ code: "ORG_NOT_VERIFIED" });
  }
  next();
}
```

---

## 9. Two-Factor Authentication (2FA)

**2FA is handled entirely by Casso Accounts.** Your app does not need TOTP pages, email OTP inputs, or trusted-device management.

When a user has TOTP or email OTP enabled, the flow looks like this:

```text
Browser -> Your app /auth/login
  -> Redirect to Casso /authorize
  -> Casso login UI
  -> Casso TOTP or email OTP UI
  -> Casso sets trusted device cookie
  -> Redirect back to /auth/callback?code=...
  -> Your app exchanges code for tokens
```

### When 2FA is triggered


| User's 2FA setup | Device    | Result                    |
| ---------------- | --------- | ------------------------- |
| TOTP enabled     | Trusted   | 2FA skipped               |
| TOTP enabled     | Untrusted | TOTP prompt shown         |
| Email OTP only   | Trusted   | 2FA skipped               |
| Email OTP only   | Untrusted | OTP sent and prompt shown |


### What integrators need to know

- The `/authorize` redirect may pause on extra pages before the callback happens.
- Your callback logic does **not** change.
- The trusted-device cookie is managed on the Casso domain (`casso_trusted_device`, httpOnly, 30-day TTL).
- Plan for the OTP step to take up to **5 minutes**. Keep your PKCE/session state alive long enough.

---

## 10. Switch Organization

To let a user switch to a different org, start a fresh PKCE flow. Casso will show the org picker during authorization.

```ts
app.get("/auth/switch-org", async (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  req.session.codeVerifier = codeVerifier;
  req.session.state = state;

  res.redirect(await buildAuthorizeUrl(codeChallenge, state));
});
```

See `be/src/routes/auth-routes.ts`.

---

## 11. New User Signup (Org-First Flow)

Casso supports an **org-first signup flow** where a new user creates an organization, verifies email, sets a password, and returns with an authenticated session.

### Signup endpoints


| Step | Path                  | Method | Purpose                          |
| ---- | --------------------- | ------ | -------------------------------- |
| 1    | `/signup`             | GET    | Show org type selection          |
| 2    | `/signup/org-details` | POST   | Capture org details              |
| 3    | `/signup/email`       | POST   | Send email OTP                   |
| 4    | `/signup/verify-otp`  | POST   | Verify OTP                       |
| 5    | `/signup/password`    | POST   | Set password and complete signup |


### Flow features

- New user + org are created atomically
- Email verification is built in
- OTP and signup steps are rate limited
- Signup session state is persisted server-side
- `return_to` can send the user back to a target screen after success

### Integration scenarios

- If you expose an **Add Organization** action, you can redirect users to Casso's signup flow.
- If you use Casso's admin UI, users can launch signup from the org switcher.
- After signup, users either return to your app with an active session or continue the interrupted OIDC flow automatically.

### Signup error codes


| Error                     | HTTP | Cause                                                  |
| ------------------------- | ---- | ------------------------------------------------------ |
| `EMAIL_ALREADY_EXISTS`    | 400  | Email already belongs to another user                  |
| `ORG_TYPE_INVALID`        | 400  | Invalid org type                                       |
| `OTP_NOT_FOUND`           | 400  | OTP state missing                                      |
| `OTP_EXPIRED`             | 400  | OTP expired                                            |
| `OTP_ALREADY_USED`        | 400  | OTP already consumed                                   |
| `OTP_MAX_ATTEMPTS`        | 400  | Too many OTP attempts                                  |
| `UNVERIFIED_ORG_REQUIRED` | 400  | Existing user must verify an org before adding another |
| `SIGNUP_NOT_AVAILABLE`    | 503  | Signup infrastructure unavailable                      |


### Organization requirement mode

When `ORG_REQUIREMENT_MODE=hard`, `/authorize` intercepts users who do not belong to any org and redirects them to Casso's signup flow **before** issuing an auth code.

```text
Browser -> Your app /auth/login
  -> Redirect to Casso /authorize
  -> Casso detects user has no org
  -> Redirect to Casso /signup
  -> User completes org setup
  -> Redirect back to your callback with a valid auth code
```

Your app does not need special callback logic for this mode.

---

## 12. Entitlements API

Use the entitlements API to grant or revoke app access. The demo uses Basic auth with the same `CLIENT_ID:CLIENT_SECRET` pair as OIDC.

```ts
function basicAuthHeader(): string {
  return (
    "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
  );
}

const headers = {
  "Content-Type": "application/json",
  Authorization: basicAuthHeader(),
};
```

> Entitlement changes take effect on the user's next login because token claims are snapped at issuance time.

### POST /api/apps/entitlements — Grant access

```ts
await fetch(`${CASSO_BASE_URL}/api/apps/entitlements`, {
  method: "POST",
  headers,
  body: JSON.stringify({ email, orgId, role }), // role is optional
});
```

**201 ENTITLEMENT_GRANTED** — user is already an org member:

```json
{
  "success": true,
  "code": "ENTITLEMENT_GRANTED",
  "data": {
    "entitlement": {
      "id": "uuid",
      "orgMemberId": "uuid",
      "appId": "uuid",
      "enabled": true,
      "role": "app_admin",
      "createdAt": "2025-03-15T10:00:00.000Z",
      "updatedAt": "2025-03-15T10:00:00.000Z",
      "orgMember": {
        "user": { "id": "uuid", "email": "user@example.com" },
        "org": { "id": "uuid", "name": "Acme Corp" }
      },
      "app": { "id": "uuid", "key": "your-app-key", "name": "Your App" }
    }
  }
}
```

**202 INVITATION_SENT_DEFERRED** — user is not yet an org member; invitation sent, entitlement granted on acceptance:

```json
{
  "success": true,
  "code": "INVITATION_SENT_DEFERRED",
  "data": {
    "invitationId": "uuid",
    "email": "user@example.com",
    "expiresAt": "2025-04-15T10:00:00.000Z"
  }
}
```

### DELETE /api/apps/entitlements — Revoke access

```ts
await fetch(`${CASSO_BASE_URL}/api/apps/entitlements`, {
  method: "DELETE",
  headers,
  body: JSON.stringify({ email, orgId }),
});
```

**200 ENTITLEMENT_REVOKED:**

```json
{ "success": true, "code": "ENTITLEMENT_REVOKED", "data": { "id": "uuid" } }
```

### PATCH /api/apps/entitlements/role — Update role

```ts
await fetch(`${CASSO_BASE_URL}/api/apps/entitlements/role`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ email, orgId, role: null }), // null clears the role
});
```

**200 ENTITLEMENT_ROLE_UPDATED:**

```json
{
  "success": true,
  "code": "ENTITLEMENT_ROLE_UPDATED",
  "data": {
    "entitlement": {
      "id": "uuid",
      "orgMemberId": "uuid",
      "appId": "uuid",
      "enabled": true,
      "role": null,
      "createdAt": "2025-03-15T10:00:00.000Z",
      "updatedAt": "2025-03-15T10:05:00.000Z",
      "orgMember": {
        "user": { "id": "uuid", "email": "user@example.com" },
        "org": { "id": "uuid", "name": "Acme Corp" }
      },
      "app": { "id": "uuid", "key": "your-app-key", "name": "Your App" }
    }
  }
}
```

### GET /api/apps/orgs/:orgId/members — List members

List members of an org with their entitlement status for this app. Supports cursor-based pagination.

```ts
const res = await fetch(
  `${CASSO_BASE_URL}/api/apps/orgs/${orgId}/members?scope=app&limit=50`,
  { headers }
);
const { data } = await res.json();
// data.members, data.invitations (scope=all only), data.pagination
```

**Query parameters**


| Parameter | Default | Description                                                                                                  |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| `scope`   | `app`   | `app` — members with an entitlement only; `org` — all org members; `all` — org members + pending invitations |
| `limit`   | `50`    | Page size (1–100)                                                                                            |
| `cursor`  | —       | Pagination cursor from previous response's `pagination.nextCursor`                                           |


**200 MEMBERS_LIST**

```json
{
  "success": true,
  "code": "MEMBERS_LIST",
  "data": {
    "members": [
      {
        "userId": "usr_abc123",
        "email": "alice@example.com",
        "entitlement": { "enabled": true, "role": "app_admin" }
      },
      {
        "userId": "usr_def456",
        "email": "bob@example.com",
        "entitlement": null
      }
    ],
    "invitations": [
      {
        "email": "carol@example.com",
        "status": "PENDING",
        "hasPendingEntitlement": true,
        "expiresAt": "2025-07-01T00:00:00.000Z"
      }
    ],
    "pagination": { "nextCursor": "cursor_xyz", "hasMore": true }
  }
}
```

> `invitations` is only included when `scope=all`. `entitlement` is `null` for org members who have no entitlement for this app (only returned when `scope=org` or `scope=all`).

See `be/src/lib/casso-entitlement-client.ts`.

---

## 13. Frontend SPA Pattern (Vite Proxy)

For SPAs, proxy `/api/*` and `/auth/*` to the backend to avoid CORS and cookie issues.

```ts
// fe/vite.config.ts
export default defineConfig({
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/auth": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

In the frontend, always include credentials so session cookies are forwarded:

```ts
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return res.json() as Promise<T>;
}
```

See `fe/vite.config.ts` and `fe/src/lib/api-client.ts`.

---

## 14. Logout

Destroy the local session, then redirect the browser to Casso's logout endpoint.

```ts
app.get("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    const logoutUrl = new URL(`${CASSO_BASE_URL}/logout`);
    logoutUrl.searchParams.set("redirect_uri", APP_URL);
    res.redirect(logoutUrl.toString());
  });
});
```

For programmatic session revocation, Casso also exposes `POST /revoke-session`.

```ts
const res = await fetch(`${CASSO_BASE_URL}/revoke-session`, {
  method: "POST",
  headers: { Cookie: `casso_session=${sessionCookie}` },
});
```

---

## 15. Webhook Events

Casso can push signed events to your app when membership, entitlement, or org-verification state changes.

### 15a. Register and manage a webhook

Use Basic auth with `CLIENT_ID:CLIENT_SECRET`.

```ts
const auth =
  "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

const { secret } = await fetch(`${CASSO_BASE_URL}/api/apps/${APP_ID}/webhook`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: auth,
  },
  body: JSON.stringify({
    endpointUrl: "https://yourapp.com/webhooks/casso",
    isActive: true,
  }),
}).then((r) => r.json());

// secret is returned only on first creation - store it immediately
```


| Method   | Path                                         | Purpose                         |
| -------- | -------------------------------------------- | ------------------------------- |
| `PUT`    | `/api/apps/:appId/webhook`                   | Create or update webhook config |
| `GET`    | `/api/apps/:appId/webhook`                   | Read current config             |
| `DELETE` | `/api/apps/:appId/webhook`                   | Remove config                   |
| `POST`   | `/api/apps/:appId/webhook/rotate`            | Rotate secret                   |
| `POST`   | `/api/apps/:appId/webhook/test`              | Send synthetic test event       |
| `GET`    | `/api/apps/:appId/webhook/deliveries`        | View delivery history           |
| `POST`   | `/api/apps/:appId/webhook/retry/:deliveryId` | Retry a failed delivery         |


**Operational examples**

```bash
# Rotate secret
curl -X POST https://next.accounts.casso.vn/api/apps/{appId}/webhook/rotate \
  -H "Authorization: Basic $(echo -n 'clientId:clientSecret' | base64)"

# Fire a test event
curl -X POST https://next.accounts.casso.vn/api/apps/{appId}/webhook/test \
  -H "Authorization: Basic $(echo -n 'clientId:clientSecret' | base64)" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"member.added"}'

# View delivery history
curl -X GET 'https://next.accounts.casso.vn/api/apps/{appId}/webhook/deliveries?limit=50&offset=0' \
  -H "Authorization: Basic $(echo -n 'clientId:clientSecret' | base64)"

# Retry a failed delivery
curl -X POST https://next.accounts.casso.vn/api/apps/{appId}/webhook/retry/{deliveryId} \
  -H "Authorization: Basic $(echo -n 'clientId:clientSecret' | base64)"
```

> Webhook endpoints must be public HTTPS URLs. Do not point them at localhost or private IP ranges.

### 15b. Verify the signature

The webhook request includes these headers:

- `x-webhook-signature` — `sha256=<hmac-hex>`
- `x-webhook-timestamp` — signing time in **milliseconds** (same value embedded in the JSON body's `timestamp` field)

The signature is computed over the **raw JSON body** (which already contains the `timestamp` field). Do **not** prefix with `${timestamp}.` — the timestamp lives inside the body.

```ts
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers["x-webhook-signature"] as string | undefined;

  if (!signature) {
    res.status(400).json({ code: "MISSING_SIGNATURE" });
    return;
  }

  const rawBody = req.body as Buffer;

  // Replay-attack check: parse timestamp from body (it's already there)
  const parsed = JSON.parse(rawBody.toString()) as { timestamp?: number };
  if (
    !parsed.timestamp ||
    Math.abs(Date.now() - parsed.timestamp) > 5 * 60 * 1000
  ) {
    res.status(400).json({ code: "TIMESTAMP_EXPIRED" });
    return;
  }

  // HMAC is over the raw body bytes — do NOT re-serialize
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const actual = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expected, "hex"),
    );
    if (!isValid) throw new Error("signature mismatch");
  } catch {
    res.status(401).json({ code: "INVALID_SIGNATURE" });
    return;
  }

  req.webhookEvent = parsed;
  next();
}

app.post(
  "/webhooks/casso",
  express.raw({ type: "application/json" }),
  verifyWebhookSignature,
  async (req, res) => {
    await handleWebhookEvent(req.webhookEvent);
    res.status(200).json({ code: "OK" });
  },
);
```

> Mount `express.raw()` on this route before any JSON body parsing so `req.body` remains a raw `Buffer`.

See `be/src/middleware/verify-webhook-signature.ts`.

### 15c. Payload structure

```json
{
  "id": "evt_550e8400-e29b-41d4-a716-446655440000",
  "type": "member.added",
  "timestamp": 1713700000000,
  "data": {
    "userId": "user_123",
    "orgId": "org_456",
    "email": "user@example.com",
    "role": "MEMBER"
  }
}
```

**Supported events**


| Event                      | `data` fields                                          | Typical action            |
| -------------------------- | ------------------------------------------------------ | ------------------------- |
| `member.added`             | `userId`, `orgId`, `email`, `role`                     | Upsert org member         |
| `member.removed`           | `userId`, `orgId`                                      | Remove member             |
| `member.role_updated`      | `userId`, `orgId`, `role`                              | Update org role           |
| `entitlement.granted`      | `userId`, `orgId`, `email`, `role`, `appId`, `appRole` | Grant app access          |
| `entitlement.revoked`      | `userId`, `orgId`, `appId`                             | Revoke app access         |
| `entitlement.role_updated` | `userId`, `orgId`, `appId`, `appRole`                  | Update app role           |
| `org.verified`             | `orgId`                                                | Unlock KYC-gated features |
| `user.updated`             | `userId`, `email`                                      | Sync profile or email     |


### 15d. Idempotency and retries

Casso retries failed deliveries up to **5 times** with exponential backoff. Treat delivery handling as idempotent.

The demo stores processed webhook IDs with `INSERT IGNORE`:

```sql
INSERT IGNORE INTO webhook_events (event_id, event_type)
VALUES (?, ?)
```

The demo uses `payload.id` (from the JSON body, verified after signature check) as the dedupe key. Return quickly, then do heavy work asynchronously if needed.

See `be/src/routes/webhook-routes.ts`.

**Event ordering:** Casso does not guarantee delivery order between different event types. When a member accepts an invitation with an app entitlement, both `member.added` and `entitlement.granted` fire within milliseconds — either may arrive first. Each event is **self-contained**: `entitlement.granted` carries `userId`, `orgId`, `email`, `role`, `appId`, and `appRole`, so your handler can upsert the member record from it without depending on a prior `member.added`. Always use upsert semantics (see demo handler in `be/src/lib/webhook-event-handler.ts`).

---

## 16. Error Reference

### Authorization errors (redirect params)


| Error code        | Cause                                   |
| ----------------- | --------------------------------------- |
| `access_denied`   | User is not entitled to this app        |
| `invalid_request` | Missing or malformed request parameters |
| `server_error`    | Internal provider error                 |
| `invalid_state`   | State mismatch or expired login attempt |


### Token endpoint errors (JSON body)


| Code                    | Cause                                   |
| ----------------------- | --------------------------------------- |
| `INVALID_CLIENT`        | Unknown `client_id`                     |
| `INVALID_CLIENT_SECRET` | Wrong `client_secret`                   |
| `INVALID_CODE`          | Authorization code not found or invalid |
| `CODE_EXPIRED`          | Authorization code expired              |
| `CODE_ALREADY_USED`     | Code already exchanged                  |
| `INVALID_CODE_VERIFIER` | PKCE verification failed                |


---

## 17. Environment Variables

```bash
# Demo backend
PORT=3000
APP_URL=http://localhost:5174
SESSION_SECRET=replace-me

# Session store
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=test_app
DB_USER=root
DB_PASSWORD=secret

# Casso OIDC
CASSO_BASE_URL=http://localhost:3003
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3000/auth/callback
APP_ID=your-app-id

# Optional - webhook verification
WEBHOOK_SECRET=whk_abc123
```

---

## 18. Security Checklist

- [ ] Use Authorization Code + PKCE on every login
- [ ] Validate `state` in the callback
- [ ] Store `code_verifier` and refresh tokens server-side only
- [ ] Verify Bearer tokens with JWKS (`issuer`, `audience`, `algorithms`)
- [ ] Restrict JWT verification to `RS256`
- [ ] Use a persistent session store in production
- [ ] Set session cookies to `httpOnly`, `sameSite: "lax"`, and `secure` in production
- [ ] Save the rotated refresh token returned by every refresh call
- [ ] Enforce KYC-sensitive rules in the backend, not only the frontend
- [ ] Verify webhook signatures against the raw request body
- [ ] Reject stale webhook timestamps and dedupe on event ID
- [ ] Never commit `.env` files containing `CLIENT_SECRET`, `SESSION_SECRET`, or webhook secrets
- [ ] Do not build your own TOTP / OTP UI for the OIDC login flow

---

## 19. JWKS Caching

`jose.createRemoteJWKSet` already handles caching and key rotation well. Recommended settings:


| Setting            | Value      | Reason                                         |
| ------------------ | ---------- | ---------------------------------------------- |
| `cacheMaxAge`      | 10 minutes | Good balance between freshness and performance |
| `cooldownDuration` | 30 seconds | Prevents hammering JWKS on key misses          |


During key rotation, Casso may serve both old and new keys for a grace period. Using `createRemoteJWKSet` lets your app handle this without custom rotation logic.

---

## 20. Local Development

### Run Casso Accounts locally

```bash
cd ../casso-accounts-next
docker-compose up -d
npm run dev
```

This starts the provider at `http://localhost:3003`.

### Run the demo backend

```bash
cd be
npm install
npm run db:init
npm run dev
```

This starts the demo backend at `http://localhost:3000`.

### Run the demo frontend

```bash
cd fe
npm install
npm run dev
```

This starts the frontend at `http://localhost:5174`.

### End-to-end smoke flow

1. Open `http://localhost:3003/auth/login` if you need to test provider-side flows directly.
2. Open `http://localhost:5174/` to test the demo frontend.
3. Log in through the demo app and confirm callback, session creation, refresh, and logout work.

