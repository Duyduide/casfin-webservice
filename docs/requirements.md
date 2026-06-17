Dưới đây là danh sách các mục tiêu tính năng được chuẩn hóa và cấu trúc lại theo định dạng Markdown phù hợp cho tài liệu yêu cầu sản phẩm (PRD) hoặc kế hoạch phát triển:

# 📌 DANH SÁCH TÍNH NĂNG ỨNG DỤNG QUẢN LÝ THU CHI

## 🔴 TÍNH NĂNG BẮT BUỘC (MUST-HAVE)

### 🔑 Hệ thống & Tài khoản

* **Đăng nhập SSO (Single Sign-On):** Hỗ trợ người dùng đăng nhập nhanh chóng, bảo mật qua các nền tảng phổ biến (Google, Apple...).
* **Quản lý Đa tài khoản (Wallets/Accounts):**
* Khả năng tạo và quản lý nhiều nguồn tiền khác nhau (Tiền mặt, thẻ tín dụng, tài khoản ngân hàng, ví điện tử).
* Theo dõi và cập nhật số dư riêng biệt cho từng nguồn tiền theo thời gian thực.



### 📝 Ghi chép & Phân loại Giao dịch

* **Ghi chép giao dịch thủ công (CRUD):** Giao diện nhập liệu nhanh cho phép người dùng thêm, sửa, xóa khoản thu/chi với đầy đủ trường thông tin: *Số tiền, Danh mục, Ngày giờ, Ghi chú, và Hình ảnh đính kèm (hóa đơn, bill).*
* **Hệ thống Danh mục (Categories):**
* Cung cấp sẵn bộ danh mục mặc định trực quan (Ăn uống, Di chuyển, Lương, Mua sắm...) đi kèm icon nhận diện.
* Cho phép người dùng linh hoạt tùy biến (tạo mới, sửa, xóa) các danh mục để cá nhân hóa.


* **Đồng bộ & Phân loại giao dịch tự động:**
* Đồng bộ luồng Transaction và hiển thị lịch sử giao dịch trực quan.
* Hỗ trợ song song cả **phân loại bằng tay** và **AI tự động phân loại** luồng tiền về cấu trúc chuẩn: `[Thu/Chi]` và `[Loại thu / Loại chi]`.



### 📊 Báo cáo & Thống kê

* **Thống kê dòng tiền:**
* Tự động tổng hợp dữ liệu và trực quan hóa bằng các biểu đồ (Charts).
* Xếp hạng các loại chi tiêu và phân tích biến động dòng tiền chi tiết theo dòng thời gian (Tuần, Tháng, Năm).



---

## 🟡 TÍNH NĂNG MỞ RỘNG (NICE-TO-HAVE)

* **Hũ chi tiêu (Money Pots):** Tính năng cho phép đặt mục tiêu hạn mức chi tiêu cho từng danh mục cụ thể và theo dõi, cập nhật tiến độ chi tiêu theo thời gian thực (Real-time).
* **Sổ nợ (Debt/Loan Tracking):** Quản lý chi tiết các khoản "Cho mượn" và "Đi vay", ghi chú rõ thông tin người liên quan và thiết lập hệ thống nhắc nhở khi đến thời hạn trả nợ/đòi nợ.
* **Tạo mã QR thanh toán thông minh:** Hỗ trợ tạo nhanh mã QR để nhận tiền chuyển khoản, sau khi giao dịch thành công sẽ tự động đồng bộ và ghi nhận bản ghi giao dịch vào hệ thống mà không cần nhập thủ công.