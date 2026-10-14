# Thanh toán bằng QR tĩnh

Khách xem một ảnh QR tĩnh và thông tin chuyển khoản trên `GET /payments/qr/:orderCode`.
Mã đơn vẫn được hiển thị làm nội dung chuyển khoản để nhân viên đối chiếu.

Khách chuyển khoản rồi bấm **Tôi đã chuyển khoản** (`POST /orders/:orderCode/confirm-transfer`). Đơn chuyển từ `AWAITING_PAYMENT` sang `TRANSFER_CONFIRMED`; bước này chưa ghi nhận tiền hay trừ kho. Chỉ chủ đơn có thể bấm và thao tác được ghi vào nhật ký.

Không có webhook, API đối soát, polling hoặc tự động xác nhận thanh toán. Sau khi kiểm tra giao dịch thực tế, nhân viên thuộc nhóm Support hoặc Manager chuyển từ `TRANSFER_CONFIRMED` sang `PAID` qua `PATCH /admin/orders/:orderCode/status`. Lý do là bắt buộc, mỗi lần chuyển được ghi vào nhật ký thao tác, và thời điểm nhận tiền chỉ ghi ở bước này.

Người quản lý có thể đổi ảnh QR ở **Tham số → Tài khoản nhận tiền**. Mặc định ứng dụng dùng ảnh mẫu `/payment-qr.png` đóng gói cùng web; có thể thay bằng URL HTTPS hoặc tệp đặt trong `/img/` của ứng dụng web.
