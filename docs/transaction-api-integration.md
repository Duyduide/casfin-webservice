# Tích hợp API Lịch sử Giao dịch Ngân hàng

Truy xuất lịch sử giao dịch tài khoản ngân hàng một cách tự động và an toàn. Thông qua tích hợp này, bạn có thể lấy được dữ liệu chi tiết của các giao dịch đã thực hiện, số dư, tài khoản liên quan, và nhiều thông tin hữu ích khác phục vụ cho các nhu cầu như:

- Đối soát giao dịch
- Tự động ghi nhận thu chi
- Hỗ trợ kế toán – tài chính
- Hệ thống chấm điểm tín dụng, phân tích dòng tiền

---

## Các bước tích hợp Transactions

1. **Tạo phân quyền** `/grant/token` với `scopes` có giá trị là `transaction`.
2. **Mở giao diện Cas Link** bằng `grantToken` được trả về ở bước trên.
3. **Nhận `publicToken`** — Sau khi người dùng hoàn tất xác thực, phía giao diện sẽ nhận được một `publicToken`, dùng `publicToken` này để lấy `accessToken` cho phân quyền.
4. **Gọi API lịch sử giao dịch** bằng `accessToken` vừa lấy được.

> **Lưu ý:** Sử dụng `CLIENT_ID` và `SECRET_KEY` trong file `.env` với tên biến là `CASSO_TRANSACTION_CLIENT_ID` và `CASSO_TRANSACTION_SECRET_KEY`.

---

## Bước 1 — Tạo phân quyền cho Transactions

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

> Xem chi tiết API tại: <https://sandbox.bankhub.dev/docs/grant/token>

---

## Bước 2 — Lấy `accessToken` từ `publicToken`

**Endpoint:** `POST https://sandbox.bankhub.dev/grant/exchange`

```javascript
const axios = require('axios');

const data = JSON.stringify({
  publicToken: 'bdbde2bad-7685-4f95-987c-71309a4a3',
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

> Xem chi tiết API tại: <https://sandbox.bankhub.dev/docs/grant/exchange>

---

## Bước 3 — Gọi API lịch sử giao dịch

**Endpoint:** `GET https://sandbox.bankhub.dev/transactions`

```javascript
const axios = require('axios');

const config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://sandbox.bankhub.dev/transactions',
  headers: {
    'X-BankHub-Api-Version': '2023-01-01',
    Authorization: '<ACCESS_TOKEN_HERE>',
    'x-client-id': '<CLIENT_ID_HERE>',
    'x-secret-key': '<SECRET_KEY_HERE>',
  },
};

axios.request(config)
  .then((response) => console.log(JSON.stringify(response.data)))
  .catch((error) => console.log(error));
```
