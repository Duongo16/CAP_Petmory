# Deploy PETMORY lên Vercel

Một project Vercel chứa cả hai phần:

- **Web (Angular)** build thành trang tĩnh, phục vụ từ `apps/web/dist/web/browser`.
- **API (NestJS)** chạy dạng Vercel Function tại `api/index.js`, nhận mọi đường dẫn `/api/*`.

Web gọi API qua `/api` cùng tên miền, nên không cần cấu hình CORS giữa hai tên miền.

```
Trình duyệt ──► https://<tên-miền>/            ──► trang tĩnh Angular (index.html cho mọi route)
            └─► https://<tên-miền>/api/...      ──► api/index.js ──► NestJS (apps/api/dist/serverless.js)
                                                         ├─► MongoDB Atlas
                                                         ├─► Cloudinary (ảnh, PDF xuất nhật ký)
                                                         └─► Gemini (AI văn bản)
```

## Những gì đã chỉnh để chạy được trên Vercel

| Giới hạn của Vercel | Cách xử lý trong code |
|---|---|
| Request/response tối đa ~4,5 MB | Trình duyệt tự nén ảnh xuống ≤ 4 MB trước khi gửi (`core/utils/upload-image.ts`). Ảnh phục hồi > 4 MB được đổi sang JPEG (`fitPicture` trong `image-tool.ts`). PDF xuất nhật ký không đi qua API mà tải thẳng từ Cloudinary bằng link hết hạn sau 5 phút. |
| Không có đĩa lưu lâu dài | Mọi tệp đều lưu qua `StorageService` lên Cloudinary (thêm thư mục `exports` cho PDF, lưu dạng raw). |
| Tiến trình dừng ngay sau khi trả lời | Việc chạy ngầm (dựng PDF, gửi thư) đi qua `runInBackground`, dùng `waitUntil` của Vercel. |
| Không có trình duyệt cài sẵn | Dựng PDF bằng `@sparticuz/chromium` + `playwright-core` khi chạy trên Vercel; font Noto Sans tải từ Google Fonts để chữ tiếng Việt có dấu hiển thị đúng. |
| Không có server chạy liên tục | `apps/api/src/serverless.ts` dựng ứng dụng NestJS một lần cho mỗi lần khởi động lạnh rồi dùng lại. |

Cấu hình nằm ở `vercel.json`: lệnh build, thư mục output, vùng `sin1` (Singapore), thời gian chạy tối đa 60 giây, và các rewrite cho `/api` và cho route của trang Angular.

## Lộ trình

### Bước 0. Chuẩn bị tài khoản (làm một lần)

1. Tạo tài khoản Vercel tại https://vercel.com, đăng nhập bằng GitHub/Bitbucket/GitLab chứa repo `CAP_Petmory`.
2. Chọn gói:
   - **Hobby (miễn phí):** chỉ dùng phi thương mại, đủ cho demo và nghiệm thu.
   - **Pro:** cần khi chạy thật. Gói này cho phép tăng `maxDuration` lên 300 giây nếu xuất PDF dài bị cắt.

### Bước 1. Mở MongoDB Atlas cho Vercel

1. Vào Atlas → **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Vercel không có IP cố định.
2. Vào **Database Access** → tạo một user riêng cho bản deploy (ví dụ `petmory-vercel`), quyền `readWrite` trên đúng database, mật khẩu dài và ngẫu nhiên.
3. Lấy chuỗi kết nối `mongodb+srv://petmory-vercel:<mật-khẩu>@.../<tên-db>?retryWrites=true&w=majority` để dùng ở Bước 3.

### Bước 2. Tạo project trên Vercel

1. Vercel → **Add New → Project** → chọn repo `CAP_Petmory`.
2. **Root Directory:** để trống (gốc repo, nơi có `vercel.json`).
3. **Framework Preset:** `Other`. Mọi lệnh build đã khai trong `vercel.json`, không cần điền ở màn hình này.
4. **Node.js Version** (Settings → General): chọn **22.x**.
5. **Chưa bấm Deploy.** Khai biến môi trường ở Bước 3 trước.

### Bước 3. Khai biến môi trường (Settings → Environment Variables, môi trường Production)

Bắt buộc:

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` (ẩn nút đăng nhập nhanh tài khoản mẫu). Khi demo nghiệm thu mà muốn giữ nút này thì đặt `development`. |
| `MONGODB_URI` | Chuỗi kết nối từ Bước 1 |
| `JWT_ACCESS_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự. Tạo bằng `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_REFRESH_SECRET` | Một chuỗi ngẫu nhiên khác, cũng ≥ 32 ký tự |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Giữ như `.env` hiện tại |
| `WEB_ORIGIN` | `https://<tên-miền>` (ví dụ `https://petmory.vercel.app`). Sửa lại sau Bước 4 nếu tên miền khác. |
| `STORAGE_DRIVER` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Như `.env` |
| `CLOUDINARY_SIGNED_URL_TTL` | Như `.env` |
| `UPLOAD_DIR` | `/tmp/uploads` (chỉ là chỗ tạm, không lưu gì lâu dài) |
| `UPLOAD_MAX_SIZE_MB` | `10` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | Khoá Gemini |
| `AI_TIMEOUT_MS` | `45000`. Phải nhỏ hơn `maxDuration` 60 giây. |
| `SEPAY_WEBHOOK_KEY` | Khoá webhook SePay. **Không** dùng giá trị mẫu `change-this-key-before-running`. |

Tuỳ chọn:

| Biến | Khi nào cần |
|---|---|
| `AI_MODEL`, `AI_IMAGE_PROVIDER`, `AI_IMAGE_MODEL` | Đổi model AI. Để trống thì dùng mặc định: phục hồi ảnh qua Cloudinary. |
| `SEPAY_API_BASE`, `SEPAY_API_TOKEN`, `SEPAY_ALLOWED_IPS`, `SEPAY_TIMEOUT_MS` | Nếu đang dùng ở `.env` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TIMEOUT_MS` | Cần cho chức năng "Quên mật khẩu" khi `NODE_ENV=production`. Thiếu SMTP thì thư không gửi được và log ghi lỗi. |

Không khai `API_PORT` vì trên Vercel API không tự mở cổng.

### Bước 4. Deploy lần đầu

- **Cách A, qua Git (khuyên dùng):** bấm **Deploy** trên Vercel. Từ đó mỗi lần push lên nhánh chính sẽ tự deploy production, còn push nhánh khác tạo bản preview.
- **Cách B, bằng CLI từ máy:**
  ```bash
  npm i -g vercel
  vercel login
  vercel link          # chọn đúng project vừa tạo
  vercel --prod
  ```

Build mất khoảng 2–4 phút. Log build phải có cả `tsc` của API và `Application bundle generation complete` của web.

### Bước 5. Việc cần làm sau khi có tên miền

1. Cập nhật `WEB_ORIGIN` đúng tên miền thật, rồi **Redeploy**.
2. SePay → cấu hình webhook → URL `https://<tên-miền>/api/payments/webhook`, header `Authorization: Apikey <SEPAY_WEBHOOK_KEY>`.
3. (Tuỳ chọn) Gắn tên miền riêng ở Settings → Domains, rồi lặp lại mục 1–2 với tên miền đó.

### Bước 6. Kiểm tra sau deploy

| # | Việc kiểm | Kỳ vọng |
|---|---|---|
| 1 | Mở `https://<tên-miền>/api/catalog/packaging` | Trả JSON danh sách hộp/khung. Lần đầu có thể chậm 3–8 giây (khởi động lạnh). |
| 2 | Mở `https://<tên-miền>/shop`, tải lại trang (F5) | Trang hiện bình thường, không lỗi 404. Rewrite route Angular hoạt động. |
| 3 | Đăng ký, đăng nhập, tạo hồ sơ bé | Thành công |
| 4 | Tải ảnh 10–15 MB chụp từ điện thoại | Lên được (đã tự nén ≤ 4 MB) |
| 5 | Studio: Dựng mẫu từ ảnh | Nhận ra loài và màu, mở bước Chọn mẫu |
| 6 | Phục hồi ảnh với "Tách nền" | Chạy được (Cloudinary) |
| 7 | Nhật ký → Xuất PDF → Tải về | Có file PDF, chữ tiếng Việt có dấu đúng |
| 8 | Đặt hàng → quét QR → SePay báo về | Đơn chuyển sang đã thanh toán |
| 9 | Trang quản trị: đăng nhập quanly@ | Vào được bàn điều phối |
| 10 | Vercel → Logs | Không có lỗi `FUNCTION_PAYLOAD_TOO_LARGE`, `FUNCTION_INVOCATION_TIMEOUT`, hay lỗi kết nối Mongo |

## Khi gặp lỗi

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Mọi `/api` trả 500, log ghi `MongoServerSelectionError` hoặc TLS alert 80 | Atlas chưa mở IP | Bước 1.1 |
| Log ghi `Missing required environment variable` | Thiếu biến bắt buộc | Bước 3, rồi Redeploy |
| 413 `FUNCTION_PAYLOAD_TOO_LARGE` | Tệp trên 4,5 MB đi qua API | Báo lại kèm đường dẫn API bị lỗi |
| 504 `FUNCTION_INVOCATION_TIMEOUT` khi xuất PDF dài | Vượt 60 giây | Lên gói Pro rồi tăng `maxDuration` trong `vercel.json` (tối đa 300) |
| Đăng nhập được nhưng gọi API báo CORS | `WEB_ORIGIN` sai tên miền | Sửa và Redeploy |
| PDF chữ có dấu bị ô vuông | Không tải được Google Fonts | Kiểm lại mạng của function, hoặc nhúng font vào gói |

## Giới hạn còn lại

- **Khởi động lạnh:** lần gọi API đầu tiên sau một lúc không dùng chậm 3–8 giây.
- **Ảnh HEIC trên Chrome:** chưa đọc được. Màn hình báo rõ lý do và gợi ý chọn JPG/PNG.
- **Việc chạy ngầm bị cắt:** việc chạy ngầm (dựng PDF, gửi thư) bị cắt nếu vượt `maxDuration`. Khi đó bản xuất PDF ở lại trạng thái chờ, người dùng cần xuất lại.
