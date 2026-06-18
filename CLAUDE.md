# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (Docker — recommended)
docker compose up --build        # first run
docker compose up                # subsequent runs
docker compose up --watch        # Developer run
docker compose exec api npx prisma migrate dev --name <name>
docker compose exec api npx prisma studio
docker compose logs -f api

# Type check (requires local node_modules)
npm install && npx prisma generate
npx tsc --noEmit
```

## Architecture

**Stack:** NestJS 10 · Prisma · PostgreSQL 16 · Docker Compose (`api` + `db` only, no Redis)

**Auth flow (Casso OIDC — server-side session, NOT Bearer tokens):**
1. Mobile opens `GET /api/auth/login` in Expo WebBrowser
2. Backend generates PKCE, stores `codeVerifier`+`state` in session, redirects to Casso `/authorize`
3. Casso redirects to `GET /api/auth/callback` — backend exchanges code, calls `UsersService.findOrCreate()`, stores tokens + user in PostgreSQL session
4. Backend redirects to `myapp://auth/callback?success=true` (mobile deep link)
5. All subsequent requests carry session cookie; `TokenRefreshMiddleware` auto-refreshes access token when < 5 min remaining (per-session mutex prevents race conditions)

Session store: PostgreSQL via `connect-pg-simple` (`createTableIfMissing: true`).

**Module structure (flat — all under `src/`):**
- `auth/` — OIDC/PKCE, session guard, token refresh middleware, `@CurrentUser()` decorator
- `prisma/` — `PrismaService` (@Global, injected everywhere)
- `sync/` — cron job every 4h (`0 */4 * * *`), manual trigger via `POST /api/accounts/:id/sync`; rate limit enforced via `account.lastSyncedAt` (skip if < 60s ago)
- `ai/` — Gemini Flash, called on-demand from `TransactionsService.suggestCategory()`
- `upload/` — Cloudflare R2 via `@aws-sdk/client-s3`

**Key invariants:**
- Every route (except `auth/*`) requires `@UseGuards(SessionGuard)`. `SessionGuard` is provided directly in each module's `providers[]` (not imported via AuthModule) to avoid potential circular deps.
- `session.user.id` = DB UUID (primary key of `users` table). `session.user.cassoSub` = Casso UUID. Always use `user.id` for DB queries.
- Balance updates **must** use `AccountsService.updateBalance(tx, ...)` inside a `prisma.$transaction()` — never update `account.balance` outside a transaction.
- `Transaction.status`: `pending_bank_confirm` (created by app, awaiting bank match) vs `confirmed` (matched or purely from bank). Dedup window: amount + accountId + ±5 min.
- Money Pot check happens inside the same DB transaction as the expense creation. Returns `budgetAlert` in response body when limit exceeded — does NOT block the transaction.
- `UsersService.findOrCreate()` seeds default categories (from `src/categories/default-categories.constant.ts`) inside a `prisma.$transaction()` on first login.

**Swagger:** Available at `/api/docs` in non-production only. Auth via session cookie (`connect.sid`). Access `/api/auth/login` first.

**`UpdateDto` restrictions** (enforced via `OmitType`):
- `UpdateTransactionDto` blocks changing `type`, `accountId`, `toAccountId`
- `UpdateDebtDto` blocks changing `type` (lend/borrow)
- `UpdateBudgetDto` blocks changing `categoryId` + `period` (composite unique key)
