# Thanh toán chuyển khoản qua SePay

Khách chuyển khoản theo mã QR. SePay theo dõi tài khoản ngân hàng của cửa hàng và
báo về hệ thống qua webhook. Hệ thống tìm mã đơn trong nội dung chuyển khoản, so
số tiền rồi chuyển đơn sang **Đã thanh toán**. Mọi giao dịch nhận được đều ghi vào
**Nhật ký thanh toán**, kể cả giao dịch không khớp đơn nào.

## Các bước cấu hình khi tích hợp thật

1. **Tài khoản nhận tiền.** Vào trang *Tham số* (nhóm Quản lý), điền đúng ngân hàng
   (mã BIN 6 số), số tài khoản và tên chủ tài khoản. Đây phải là tài khoản đã liên
   kết với SePay. Mã QR được tạo từ các thông tin này, và webhook bỏ qua giao dịch
   vào một tài khoản khác.
2. **Khoá webhook.** Tạo một chuỗi ngẫu nhiên dài:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   rồi đặt vào biến môi trường `SEPAY_WEBHOOK_KEY` của API. Thiếu biến này thì
   webhook từ chối mọi yêu cầu; không có khoá mặc định.
3. **Webhook trên SePay** (*Webhooks > Thêm webhook*):
   - Sự kiện: **có tiền vào**.
   - URL: `https://<ten-mien-api>/api/payments/webhook`.
   - Kiểu chứng thực: **API Key**, khoá đúng bằng `SEPAY_WEBHOOK_KEY`. SePay gửi
     tiêu đề `Authorization: Apikey <khoá>`.
   - Nên để SePay gửi **cả giao dịch không có mã thanh toán**. Nhờ vậy nhật ký ghi
     lại cả khoản khách gõ sai nội dung, giúp tra cứu khi khách báo đã trả tiền.
   - Nếu SePay hỏi cách nhận diện mã thanh toán: tiền tố `PM`, phần sau là chữ số,
     dài 9 đến 10 ký tự. Hệ thống tự tìm mã trong nội dung nên không phụ thuộc vào
     cấu hình này; nếu SePay gửi kèm trường `code` thì mã đó được thử trước.
4. **Đối soát (nên có).** Tạo API Token trong SePay rồi đặt vào `SEPAY_API_TOKEN`.
   Nút **Đối soát SePay** trên trang Nhật ký thanh toán lấy giao dịch tiền vào của
   2 ngày gần nhất và ghi nhận những giao dịch webhook đã bỏ lỡ. Chạy bao nhiêu lần
   cũng không ghi nhận tiền hai lần.
5. **Chặn theo IP (tuỳ chọn).** `SEPAY_ALLOWED_IPS` nhận danh sách IP của SePay,
   cách nhau dấu phẩy (xem `.env.example`). Chỉ bật khi API nhận được IP thật của
   bên gọi. Nếu API đứng sau proxy mà chưa cấu hình `trust proxy` thì mọi webhook
   sẽ bị chặn.

## Kết quả của một giao dịch

| Kết quả | Khi nào | Hệ thống làm gì |
|---|---|---|
| Khớp đơn | Đúng số tiền, đơn đang chờ | Chuyển đơn sang Đã thanh toán |
| Chuyển dư | Nhiều hơn số phải trả | Chuyển đơn sang Đã thanh toán, **đánh dấu đơn** để hoàn phần dư |
| Thiếu tiền | Ít hơn số phải trả | Giữ đơn chờ, **đánh dấu đơn** để liên hệ khách |
| Tiền về khi đơn không còn chờ | Đơn đã huỷ hoặc đã trả, hoặc khách trả hai lần | **Đánh dấu đơn** để xem hoàn tiền |
| Không tìm thấy mã đơn | Nội dung không có mã đơn nào có thật | Chỉ ghi nhật ký, cần tra tay |
| Bỏ qua | Tiền ra, hoặc tiền vào tài khoản khác | Chỉ ghi nhật ký |

Đơn bị đánh dấu hiện cảnh báo ở trang chi tiết đơn của nhóm vận hành, kèm lý do và
số tiền. Hệ thống không tự hoàn tiền và không tự cộng dồn các lần chuyển thiếu.

## Đảm bảo an toàn

- **Chống trùng:** mã giao dịch của SePay là khoá duy nhất trong nhật ký. Giao
  dịch gửi lại, hoặc vừa qua webhook vừa qua đối soát, chỉ được xử lý một lần.
- **Khoá webhook:** so sánh theo thời gian cố định. Thiếu khoá thì từ chối tất cả.
- **Dữ liệu sai:** thiếu mã giao dịch hoặc số tiền có phần lẻ thì trả 400, không ghi
  nhận gì. SePay sẽ gửi lại và người vận hành thấy lỗi trong trang của SePay.
- **Trường lạ:** SePay thêm trường mới thì vẫn nhận bình thường. Bản gốc của mỗi
  giao dịch được lưu nguyên trong nhật ký.
- **Phản hồi:** luôn là HTTP 200 kèm `{"success": true, "result": ...}`, đúng như
  SePay yêu cầu.

## Thử khi phát triển

SePay cần gọi được vào API, nên khi chạy trên máy cá nhân phải mở đường hầm (ví
dụ `cloudflared tunnel` hoặc `ngrok`) rồi đặt URL đó làm URL webhook. Muốn thử
không qua SePay thì gửi đúng dạng SePay gửi:

```
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Apikey $SEPAY_WEBHOOK_KEY" \
  -d '{"id":92704,"gateway":"VietinBank","transactionDate":"2026-10-04 10:00:00",
       "accountNumber":"<so-tai-khoan>","code":null,"content":"PM261004001 chuyen tien",
       "transferType":"in","transferAmount":750000,"accumulated":0,"referenceCode":"FT00001"}'
```

Kiểm thử tự động:

- `node tools/test-payment-api.js`: 38 kiểm tra, gồm mọi kết quả ở bảng trên.
- `node tools/test-payment-log-ui.js`: trang nhật ký và nút đối soát.
- `npx vitest run src/modules/payments` (trong `apps/api`): tìm mã đơn, đọc số
  tiền, đối soát với dữ liệu theo đúng mẫu API của SePay.

## Còn để ngỏ

- **Đơn quá hạn không tự huỷ.** Quá hạn thì trang thanh toán ẩn mã QR, nhưng tiền
  về muộn vẫn được ghi nhận. Muốn tự huỷ thì cần một tác vụ định kỳ có khoá phân
  tán khi chạy nhiều máy chủ.
- **Đối soát chưa chạy định kỳ.** Hiện chạy bằng nút bấm, cùng lý do như trên.
- **Hoàn tiền làm tay** theo cảnh báo trên đơn.
