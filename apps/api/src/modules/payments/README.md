# Thanh toán bằng QR tĩnh

Khách xem một ảnh QR tĩnh và thông tin chuyển khoản trên `GET /payments/qr/:orderCode`.
Mã đơn vẫn được hiển thị làm nội dung chuyển khoản để nhân viên đối chiếu.

Không có webhook, API đối soát, polling hoặc tự động xác nhận thanh toán. Sau khi kiểm tra giao dịch thực tế, nhân viên thuộc nhóm Support hoặc Manager chuyển trạng thái đơn qua `PATCH /admin/orders/:orderCode/status`. Lý do là bắt buộc và mỗi lần chuyển được ghi vào nhật ký thao tác.

Người quản lý cấu hình ảnh QR ở **Tham số → Tài khoản nhận tiền**. Chỉ chấp nhận URL HTTPS hoặc tệp đặt trong `/img/` của ứng dụng web. Nếu chưa cấu hình ảnh, API sẽ từ chối mở trang thanh toán thay vì hiển thị một mã không xác định người nhận.
