# Tích hợp API Lịch sử Giao dịch Ngân hàng

Truy xuất lịch sử giao dịch tài khoản ngân hàng một cách tự động và an toàn. Thông qua tích hợp này, bạn có thể lấy được dữ liệu chi tiết của các giao dịch đã thực hiện, số dư, tài khoản liên quan, và nhiều thông tin hữu ích khác phục vụ cho các nhu cầu như:

- Đối soát giao dịch
- Tự động ghi nhận thu chi
- Hỗ trợ kế toán – tài chính
- Hệ thống chấm điểm tín dụng, phân tích dòng tiền

---

## Các bước tích hợp Transactions

1. **Tạo grant token** — Gọi `/grant/token` với `scopes: transaction` để nhận `grantToken`.
2. **Mở CasLink UI** — Dùng `grantToken` để tạo URL và mở giao diện CasLink. User liên kết tài khoản ngân hàng tại đây; sau khi hoàn thành, `publicToken` được gửi về `redirectUri`.
3. **Đổi `publicToken` lấy `accessToken`** — Gọi `/grant/exchange` với `publicToken`. **Lưu `accessToken` vào DB** để tái sử dụng cho các lần truy vấn sau.
4. **Truy vấn lịch sử giao dịch** — Dùng `accessToken` đã lưu để gọi `/transactions`.

> **Mấu chốt:** `accessToken` là credential dài hạn gắn với tài khoản ngân hàng của user. Cần lưu vào DB (field `bankhubAccessToken` trên bảng `Account`) ngay sau bước 3 để các lần sync sau (cron mỗi 4h hoặc manual sync) không cần user xác thực lại.

> **Credentials:** Sử dụng `CLIENT_ID` và `SECRET_KEY` từ file `.env` với tên biến là `CASSO_TRANSACTION_CLIENT_ID` và `CASSO_TRANSACTION_SECRET_KEY`.

---

## Bước 1 — Tạo grant token

**Endpoint:** `POST https://sandbox.bankhub.dev/grant/token`

```javascript
const axios = require('axios');

const data = JSON.stringify({
  scopes: 'transaction',
  language: 'vi',
  redirectUri: 'https://your-domain.vn/link',
});

const config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://sandbox.bankhub.dev/grant/token',
  headers: {
    'X-BankHub-Api-Version': '2023-01-01',
    'x-client-id': '<CLIENT_ID_HERE>',
    'x-secret-key': '<SECRET_KEY_HERE>',
    'Content-Type': 'application/json',
  },
  data,
};

axios.request(config)
  .then((response) => console.log(JSON.stringify(response.data)))
  .catch((error) => console.log(error));
```

Response trả về `grantToken` dùng cho bước tiếp theo.

> Xem chi tiết API tại: <https://sandbox.bankhub.dev/docs/grant/token>

---

## Bước 2 — Mở CasLink UI

Dùng `grantToken` nhận được từ bước 1 để tạo URL và mở giao diện CasLink:

```
https://sandbox.bankhub.dev/link?token=<GRANT_TOKEN_HERE>
```

User thực hiện liên kết tài khoản ngân hàng trên giao diện này. Sau khi hoàn thành, BankHub redirect về `redirectUri` đã khai báo ở bước 1 kèm theo `publicToken`:

```
https://your-domain.vn/link?publicToken=<PUBLIC_TOKEN_HERE>
```

Backend nhận `publicToken` từ query string này để thực hiện bước 3.

---

## Bước 3 — Đổi `publicToken` lấy `accessToken`

**Endpoint:** `POST https://sandbox.bankhub.dev/grant/exchange`

```javascript
const axios = require('axios');

const data = JSON.stringify({
  publicToken: '<PUBLIC_TOKEN_HERE>',
});

const config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://sandbox.bankhub.dev/grant/exchange',
  headers: {
    'X-BankHub-Api-Version': '2023-01-01',
    'x-client-id': '<CLIENT_ID_HERE>',
    'x-secret-key': '<SECRET_KEY_HERE>',
    'Content-Type': 'application/json',
  },
  data,
};

axios.request(config)
  .then((response) => console.log(JSON.stringify(response.data)))
  .catch((error) => console.log(error));
```

Response trả về `accessToken`. **Lưu ngay `accessToken` này vào DB** (field `bankhubAccessToken` trên bản ghi `Account` tương ứng) để dùng cho mọi lần truy vấn giao dịch về sau mà không cần user xác thực lại.

> Xem chi tiết API tại: <https://sandbox.bankhub.dev/docs/grant/exchange>

---

## Bước 4 — Truy vấn lịch sử giao dịch

**Endpoint:** `GET https://sandbox.bankhub.dev/transactions`

Sử dụng `accessToken` đã lưu trong DB để gọi API này. Có thể truyền thêm `fromDate` để lấy giao dịch từ một mốc thời gian cụ thể (hữu ích cho incremental sync).

```javascript
const axios = require('axios');

const config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://sandbox.bankhub.dev/transactions',
  params: {
    fromDate: '2024-01-01T00:00:00.000Z', // optional — lấy giao dịch từ ngày này
  },
  headers: {
    'X-BankHub-Api-Version': '2023-01-01',
    Authorization: '<ACCESS_TOKEN_HERE>',   // lấy từ DB, không cần user xác thực lại
    'x-client-id': '<CLIENT_ID_HERE>',
    'x-secret-key': '<SECRET_KEY_HERE>',
  },
};

axios.request(config)
  .then((response) => console.log(JSON.stringify(response.data)))
  .catch((error) => console.log(error));
```

---

## Luồng trong hệ thống casfin-webservice

```
POST /api/accounts/:id/link/init
  → BankhubService.createGrantToken()    [Bước 1]
  → trả về { linkUrl }                   [Bước 2: client mở URL này]

GET /api/accounts/link/callback?publicToken=...&accountId=...
  → BankhubService.exchangePublicToken() [Bước 3]
  → lưu accessToken vào Account.bankhubAccessToken (DB)

POST /api/accounts/:id/sync  (hoặc cron mỗi 4h)
  → BankhubService.fetchTransactions()  [Bước 4]
  → dùng accessToken từ DB, không cần user làm gì thêm
  → kết quả sync vào bảng Transaction
```
