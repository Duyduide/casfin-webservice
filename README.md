# CasFin Webservice

Backend API cho ứng dụng quản lý thu chi cá nhân. Xây dựng bằng NestJS + PostgreSQL, tích hợp Casso SSO.

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (bao gồm Docker Compose)
- Node.js 20+ (chỉ cần khi chạy ngoài Docker)

---

## Cách chạy (Development)

### 1. Cấu hình môi trường

```bash
cp .env.example .env
```

Mở `.env` và điền các giá trị thật:

| Biến | Mô tả |
|---|---|
| `SESSION_SECRET` | Chuỗi random dài, dùng để ký session cookie |
| `CASSO_BASE_URL` | URL Casso Accounts (ví dụ: `https://next.accounts.casso.vn`) |
| `CLIENT_ID` | Client ID đã đăng ký trong Casso |
| `CLIENT_SECRET` | Client Secret tương ứng |
| `APP_ID` | App ID trong Casso |
| `REDIRECT_URI` | `http://localhost:3000/api/auth/callback` |
| `MOBILE_DEEP_LINK_SCHEME` | Deep link của mobile app (ví dụ: `myapp://auth/callback`) |
| `R2_ENDPOINT` | Endpoint Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key |
| `R2_BUCKET_NAME` | Tên bucket trên R2 |
| `R2_PUBLIC_URL` | Public URL của bucket (ví dụ: `https://pub-xxx.r2.dev`) |
| `GEMINI_API_KEY` | Google Gemini API Key |

### 2. Khởi động server

```bash
docker compose up --build
```

Lần đầu chạy sẽ mất vài phút để build image. Các lần sau dùng:

```bash
docker compose up
```

### 3. Chạy database migration

Mở terminal mới (trong khi Docker đang chạy):

```bash
docker compose exec api npx prisma migrate dev
```

Server sẽ sẵn sàng tại:
- **API:** `http://localhost:3000/api`
- **Swagger UI:** `http://localhost:3000/api/docs`

---

## Luồng đăng nhập (Casso SSO)

1. Mobile app mở `http://localhost:3000/api/auth/login` trong Expo WebBrowser
2. Backend redirect sang Casso login page
3. Sau khi đăng nhập, Casso redirect về `http://localhost:3000/api/auth/callback`
4. Backend lưu session và redirect về deep link của mobile app
5. Mobile lưu session cookie, gắn vào mọi request tiếp theo

---

## Các lệnh thường dùng

```bash
# Xem log realtime
docker compose logs -f api

# Chạy migration mới
docker compose exec api npx prisma migrate dev --name <tên_migration>

# Mở Prisma Studio (quản lý DB qua UI)
docker compose exec api npx prisma studio

# Dừng server
docker compose down

# Dừng và xóa toàn bộ data (database)
docker compose down -v
```

---

## Cấu trúc project

```
src/
├── auth/           # Casso SSO — PKCE, session, token refresh
├── users/          # User management
├── accounts/       # Ví / tài khoản
├── transactions/   # Giao dịch thu chi
├── categories/     # Danh mục
├── debts/          # Sổ nợ
├── budgets/        # Hũ chi tiêu (Money Pots)
├── statistics/     # Thống kê & báo cáo
├── sync/           # Đồng bộ giao dịch ngân hàng (cron mỗi 4 tiếng)
├── upload/         # Upload ảnh lên Cloudflare R2
└── ai/             # Gợi ý danh mục bằng Gemini Flash
prisma/
├── schema.prisma   # Database schema
└── seed.ts         # Default categories
```
