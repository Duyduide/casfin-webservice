# CasFin — Frontend Brief

Tài liệu này mô tả toàn bộ tính năng và API backend để frontend (Expo React Native) implement giao diện.

---

## Tổng quan ứng dụng

**CasFin** là ứng dụng quản lý tài chính cá nhân trên mobile. Người dùng đăng nhập bằng tài khoản Casso (SSO), sau đó quản lý ví, ghi chép thu chi, theo dõi nợ, đặt hạn mức chi tiêu theo danh mục.

**Base URL:** `http://<server>:3000/api`

**Auth:** Session cookie (`connect.sid`). Mobile dùng `expo-web-browser` mở `/api/auth/login`, sau khi đăng nhập xong backend redirect về deep link. Mọi request sau đó gửi kèm cookie session.

---

## 1. Auth — Đăng nhập / Đăng xuất

### Flow đăng nhập (Expo mobile)
1. Gọi `expo-web-browser.openBrowserAsync('http://<server>/api/auth/login')`
2. Backend redirect sang Casso login page
3. Sau khi đăng nhập, Casso redirect về backend callback
4. Backend set session cookie, redirect về deep link: `myapp://auth/callback?success=true`
5. App đóng WebBrowser, dùng cookie cho các request tiếp theo

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/auth/login` | Khởi động SSO — mở trong WebBrowser |
| GET | `/auth/callback` | Callback từ Casso (backend xử lý tự động) |
| GET | `/auth/logout` | Xóa session + redirect Casso logout |
| GET | `/auth/me` | Lấy thông tin user đang đăng nhập |
| GET | `/auth/switch-org` | Chuyển tổ chức Casso |

### Response `/auth/me`
```json
{
  "id": "uuid",
  "cassoSub": "casso-uuid",
  "email": "user@example.com",
  "orgId": "org-uuid",
  "orgName": "Nguyễn Phương Duy",
  "orgType": "PERSONAL",
  "orgStatus": "ACTIVE",
  "orgKycLevel": null,
  "orgLegalId": "082204009275",
  "role": "OWNER"
}
```

---

## 2. Accounts — Quản lý ví / tài khoản

Dùng để tạo và quản lý các ví **thủ công** (tiền mặt, quỹ, thẻ tín dụng...). Ví ngân hàng liên kết với BankHub được tạo tự động qua flow ở mục 3 — không tạo thủ công.

### Loại ví (AccountType)
- `cash` — Tiền mặt
- `bank` — Tài khoản ngân hàng (tạo tự động khi link BankHub)
- `credit_card` — Thẻ tín dụng (balance có thể âm)
- `e_wallet` — Ví điện tử (MoMo, ZaloPay...)

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/accounts` | Danh sách ví của user |
| POST | `/accounts` | Tạo ví mới (tiền mặt, quỹ...) |
| PUT | `/accounts/:id` | Cập nhật tên/thông tin ví |
| DELETE | `/accounts/:id` | Xóa ví |

### POST /accounts — Body
```json
{
  "name": "Ví tiền mặt",
  "type": "cash",
  "balance": 500000,
  "currency": "VND"
}
```
> `balance` và `currency` là optional (mặc định 0 và VND).

### Account object
```json
{
  "id": "uuid",
  "name": "VCB Digibank - 123456789",
  "type": "bank",
  "balance": "45369735.70",
  "currency": "VND",
  "bankConnectionId": "uuid",
  "accountNumber": "123456789",
  "accountHolderName": "NGUYEN VAN A",
  "createdAt": "...",
  "updatedAt": "..."
}
```
> Với ví thủ công, `bankConnectionId`, `accountNumber`, `accountHolderName` đều là `null`.

---

## 3. Bank Connections — Liên kết ngân hàng qua BankHub

Cho phép user kết nối tài khoản ngân hàng thực (VCB, BIDV, MB...) để tự động đồng bộ giao dịch. Sau khi liên kết, backend tạo các `Account` tương ứng và cron job sẽ sync mỗi 4 giờ.

### Flow liên kết (4 bước)

```
1. App gọi POST /bank-connections/start
   → Backend tạo short-lived linkToken (TTL 10 phút), trả về { linkUrl }

2. App mở linkUrl trong WebBrowser/WebView
   → User chọn ngân hàng, xác thực tài khoản trên giao diện CasLink

3. CasLink redirect về http://<server>?publicToken=xxx
   → Backend tự xử lý (root middleware forward sang callback)

4. Backend đổi publicToken → accessToken, tạo Account + lưu giao dịch
   → Redirect về /api/bank-connections (browser) hoặc deep link (mobile)
```

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/bank-connections` | Danh sách bank connections (kèm accounts) |
| POST | `/bank-connections/start` | Bắt đầu flow liên kết — trả về linkUrl |
| GET | `/bank-connections/callback` | Callback từ BankHub (backend tự xử lý, không gọi trực tiếp) |
| POST | `/bank-connections/:id/sync` | Sync thủ công một bank connection |

### POST /bank-connections/start

Không cần body. Trả về:
```json
{ "linkUrl": "https://dev.link.bankhub.dev?grantToken=xxx&redirectUri=http%3A%2F%2F..." }
```

**Expo mobile — mở CasLink in-app (bắt buộc):**

> ⚠️ **Phải dùng `openAuthSessionAsync`, KHÔNG dùng `openBrowserAsync`** — `openBrowserAsync` rời khỏi app và mất session cookie. `openAuthSessionAsync` mở in-app browser overlay (iOS SFAuthenticationSession / Android Custom Tabs), giữ nguyên session cookie và tự đóng khi BankHub redirect xong.

```typescript
import * as WebBrowser from 'expo-web-browser';

const { data } = await api.post('/bank-connections/start');

// redirectUrl là scheme để openAuthSessionAsync biết khi nào đóng browser
const result = await WebBrowser.openAuthSessionAsync(
  data.linkUrl,
  'myapp://', // deep link scheme của app
);

// Sau khi browser đóng, poll để lấy accounts mới tạo
if (result.type === 'success' || result.type === 'dismiss') {
  await refetchBankConnections(); // GET /bank-connections
}
```

### POST /bank-connections/:id/sync
- Trả về `{ "message": "Sync completed" }` nếu thành công
- Trả về **429** nếu đã sync trong vòng 60 giây (kèm thông báo "Thử lại sau Xs")

### BankConnection object (GET /bank-connections)
```json
[
  {
    "id": "uuid",
    "bankCode": "vietcombank",
    "bankName": "VCB Digibank",
    "bankLogoUrl": "https://img.bankhub.dev/rounded/vietcombank.png",
    "maxHistoryDays": 365,
    "lastSyncedAt": "2026-06-17T09:00:00.000Z",
    "accounts": [
      {
        "id": "uuid",
        "name": "VCB Digibank - 123456789",
        "type": "bank",
        "balance": "45369735.70",
        "currency": "VND",
        "accountNumber": "123456789",
        "accountHolderName": "NGUYEN VAN A"
      }
    ]
  }
]
```
> `accessToken` không được trả về client vì lý do bảo mật.

---

## 4. Transactions — Giao dịch thu chi

### Loại giao dịch (TransactionType)
- `income` — Thu nhập (cộng balance ví)
- `expense` — Chi tiêu (trừ balance ví, kèm Money Pot check)
- `transfer` — Chuyển tiền giữa 2 ví nội bộ

### Trạng thái (TransactionStatus)
- `confirmed` — Giao dịch bình thường hoặc đã khớp với bank record
- `pending_bank_confirm` — Tạo từ app, chờ đồng bộ ngân hàng

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/transactions` | Danh sách giao dịch (có filter, phân trang) |
| POST | `/transactions` | Tạo giao dịch mới |
| PUT | `/transactions/:id` | Cập nhật giao dịch |
| DELETE | `/transactions/:id` | Xóa giao dịch (reverse balance tự động) |
| POST | `/transactions/suggest-category` | Gợi ý danh mục bằng AI |

### GET /transactions — Query params
| Param | Kiểu | Mô tả |
|-------|------|--------|
| `accountId` | string | Lọc theo ví |
| `type` | `income` \| `expense` \| `transfer` | Lọc theo loại |
| `from` | ISO 8601 | Từ ngày |
| `to` | ISO 8601 | Đến ngày |
| `page` | number | Trang (mặc định 1) |
| `limit` | number | Số bản ghi/trang (mặc định 20, tối đa 100) |

### Response GET /transactions
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "expense",
      "amount": "50000.00",
      "accountId": "uuid",
      "toAccountId": null,
      "categoryId": "uuid",
      "category": { "id": "uuid", "name": "Ăn uống", "icon": "🍜", "type": "expense" },
      "note": "Bún bò",
      "imageUrl": null,
      "date": "2024-06-17T08:00:00.000Z",
      "status": "confirmed",
      "bankReferenceId": null,
      "transactionDateTime": null,
      "runningBalance": null,
      "counterAccountName": null,
      "counterAccountBankName": null
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

> Các field `transactionDateTime`, `runningBalance`, `counterAccountName`, `counterAccountBankName` chỉ có giá trị với giao dịch được đồng bộ từ ngân hàng (BankHub). Giao dịch thủ công luôn là `null`.

### POST /transactions — Body
```json
{
  "accountId": "uuid",
  "type": "expense",
  "amount": 50000,
  "categoryId": "uuid",
  "note": "Bún bò sáng",
  "imageUrl": "https://r2.example.com/bill.jpg",
  "date": "2024-06-17T08:00:00.000Z"
}
```
> `toAccountId` bắt buộc khi `type = transfer`. `categoryId`, `note`, `imageUrl` là optional.

### Response POST /transactions (khi vượt Money Pot)
```json
{
  "data": { "id": "uuid", ... },
  "budgetAlert": {
    "potId": "uuid",
    "limitAmount": 2000000,
    "usedAmount": 2150000,
    "exceededBy": 150000
  }
}
```
> Giao dịch vẫn được tạo. `budgetAlert` chỉ là cảnh báo, không block.

### POST /transactions/suggest-category — Body
```json
{
  "description": "Grab food gà rán",
  "amount": 85000
}
```
Response: `{ "categoryId": "uuid", "categoryName": "Ăn uống" }`

### Lưu ý khi update/delete
- `PUT /transactions/:id` **không được** thay đổi `type`, `accountId`, `toAccountId`
- Balance ví được reverse/adjust tự động

---

## 5. Categories — Danh mục giao dịch

User được seed sẵn 15 danh mục mặc định khi đăng ký lần đầu. Có thể tạo thêm danh mục tùy chỉnh.

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/categories` | Danh sách category |
| POST | `/categories` | Tạo category tùy chỉnh |
| PUT | `/categories/:id` | Cập nhật |
| DELETE | `/categories/:id` | Xóa |

### GET /categories — Query params
| Param | Kiểu | Mô tả |
|-------|------|--------|
| `type` | `income` \| `expense` | Lọc theo loại |

### Category object
```json
{
  "id": "uuid",
  "name": "Ăn uống",
  "icon": "🍜",
  "type": "expense",
  "isDefault": true
}
```

### Danh mục mặc định được seed
**Expense:** Ăn uống 🍜, Di chuyển 🚗, Mua sắm 🛍️, Giải trí 🎬, Sức khỏe 💊, Hóa đơn & Tiện ích 💡, Giáo dục 📚, Nhà cửa 🏠, Du lịch ✈️, Khác 💸

**Income:** Lương 💼, Thưởng 🎁, Đầu tư 📈, Cho vay thu hồi 🤝, Thu nhập khác 💰

---

## 6. Budgets — Hũ chi tiêu (Money Pots)

Đặt hạn mức chi tiêu theo category và kỳ. Khi tạo `expense` vượt hạn mức, backend trả về `budgetAlert` nhưng không block giao dịch.

### Kỳ (BudgetPeriod)
- `weekly` — Theo tuần
- `monthly` — Theo tháng
- `yearly` — Theo năm

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/budgets` | Danh sách Money Pot |
| POST | `/budgets` | Tạo Money Pot mới |
| PUT | `/budgets/:id` | Cập nhật hạn mức |
| DELETE | `/budgets/:id` | Xóa Money Pot |

### POST /budgets — Body
```json
{
  "categoryId": "uuid",
  "limitAmount": 2000000,
  "period": "monthly"
}
```
> Mỗi user chỉ có 1 pot cho mỗi `(categoryId, period)`.

### PUT /budgets/:id
- **Không được** thay đổi `categoryId` và `period`
- Chỉ update được `limitAmount`

---

## 7. Debts — Sổ nợ

Theo dõi các khoản vay mượn cá nhân. Hỗ trợ thanh toán từng phần.

### Loại nợ (DebtType)
- `lend` — Mình cho người khác vay
- `borrow` — Mình đi vay người khác

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/debts` | Danh sách khoản nợ |
| POST | `/debts` | Tạo khoản nợ mới |
| PUT | `/debts/:id` | Cập nhật thông tin |
| DELETE | `/debts/:id` | Xóa khoản nợ |
| POST | `/debts/:id/payments` | Ghi nhận thanh toán |

### GET /debts — Query params
| Param | Kiểu | Mô tả |
|-------|------|--------|
| `type` | `lend` \| `borrow` | Lọc mình cho vay / mình đi vay |

### POST /debts — Body
```json
{
  "contactName": "Nguyễn Văn A",
  "type": "lend",
  "amount": 500000,
  "note": "Mượn tiền mua laptop",
  "dueDate": "2024-12-31T00:00:00.000Z"
}
```

### Debt object
```json
{
  "id": "uuid",
  "contactName": "Nguyễn Văn A",
  "type": "lend",
  "amount": "500000.00",
  "remainingAmount": "300000.00",
  "note": "...",
  "dueDate": "2024-12-31T00:00:00.000Z",
  "payments": [
    { "id": "uuid", "amount": "200000.00", "note": "Trả một phần", "createdAt": "..." }
  ]
}
```

### POST /debts/:id/payments — Body
```json
{
  "amount": 200000,
  "note": "Trả một phần"
}
```
> `remainingAmount` được trừ tự động sau khi ghi nhận thanh toán.

### Lưu ý
- `PUT /debts/:id` **không được** thay đổi `type` (lend/borrow)

---

## 8. Statistics — Thống kê

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/statistics/cash-flow` | Dòng tiền theo khoảng thời gian |
| GET | `/statistics/by-category` | Xếp hạng theo danh mục |

### GET /statistics/cash-flow — Query params
| Param | Bắt buộc | Mô tả |
|-------|----------|--------|
| `from` | ✅ | Từ ngày (ISO 8601), VD: `2024-01-01` |
| `to` | ✅ | Đến ngày (ISO 8601), VD: `2024-12-31` |
| `groupBy` | ❌ | `day` \| `week` \| `month` (mặc định `month`) |

Response:
```json
[
  { "period": "2024-01-01T00:00:00.000Z", "income": 15000000, "expense": 8500000 },
  { "period": "2024-02-01T00:00:00.000Z", "income": 15000000, "expense": 9200000 }
]
```
> Chỉ tính các transaction `confirmed`. Dùng cho line chart / bar chart thu chi.

### GET /statistics/by-category — Query params
| Param | Bắt buộc | Mô tả |
|-------|----------|--------|
| `from` | ✅ | Từ ngày |
| `to` | ✅ | Đến ngày |
| `type` | ❌ | `income` \| `expense` (mặc định `expense`) |

Response:
```json
[
  { "categoryId": "uuid", "_sum": { "amount": "3500000" } },
  { "categoryId": "uuid", "_sum": { "amount": "2100000" } }
]
```
> Sắp xếp theo amount giảm dần. Dùng cho pie chart / danh sách top chi tiêu.

---

## 9. Upload — Ảnh hóa đơn

### Endpoints

| Method | Path | Mô tả |
|--------|------|--------|
| POST | `/upload/image` | Upload ảnh lên Cloudflare R2 |

### POST /upload/image
- Content-Type: `multipart/form-data`
- Field: `file` (jpg, png, webp)

Response:
```json
{ "url": "https://pub-xxx.r2.dev/transactions/uuid.jpg" }
```
> URL này dùng cho field `imageUrl` khi tạo transaction.

---

## Lưu ý chung cho Frontend

### Số tiền
- Backend trả về `amount`, `balance`, `limitAmount`, `remainingAmount` dạng **string Decimal** (VD: `"50000.00"`)
- Khi hiển thị, format theo locale VN: `50.000 ₫`
- Khi gửi lên, gửi dạng **number**: `50000`

### Xử lý lỗi
| HTTP Status | Ý nghĩa |
|-------------|---------|
| 401 | Chưa đăng nhập / session hết hạn → redirect về login |
| 403 | Không có quyền |
| 404 | Resource không tồn tại |
| 422 | Validation error (sai format dữ liệu) |
| 429 | Rate limit sync (thử lại sau X giây) |
| 500 | Lỗi server |

### Session / Cookie
- Expo mobile cần dùng `fetch` với `credentials: 'include'` hoặc axios với `withCredentials: true`
- Session tồn tại 7 ngày, tự động refresh access token khi gần hết hạn

### Transfer transaction
- Khi `type = transfer`, bắt buộc có `toAccountId` khác `accountId`
- Balance `accountId` bị trừ, balance `toAccountId` được cộng — không double-count

### budgetAlert
Sau khi tạo expense thành công, kiểm tra response có field `budgetAlert` không:
```typescript
if (response.budgetAlert) {
  // Hiển thị toast/banner: "Bạn đã vượt hạn mức Ăn uống tháng này 150.000 ₫"
}
```
