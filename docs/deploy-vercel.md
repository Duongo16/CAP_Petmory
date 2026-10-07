# Deploy PETMORY lên Vercel

PETMORY deploy thành **một project Vercel ở chế độ Services** (https://vercel.com/docs/services), gồm hai service build riêng và dùng chung một tên miền:

| Service | Thư mục | Framework | Đường công khai |
|---|---|---|---|
| `api` | `apps/api` | NestJS, chạy dạng Vercel Function (Fluid compute) | `/api/*` |
| `web` | `apps/web` | Angular, trang tĩnh | mọi đường còn lại |

Không service nào là nội bộ, và không có binding:

- Trình duyệt gọi API qua `/api` cùng tên miền (`apiBase: '/api'`).
- API cần đọc danh sách mô hình (`models/manifest.json`) của web. Vì hai service đóng gói riêng, API tải file này qua đường công khai của chính bản deploy.

```
Trình duyệt ──► https://<tên-miền>/...      ──► service web  (index.html cho mọi route Angular)
            └─► https://<tên-miền>/api/...  ──► service api  (nhận nguyên đường dẫn /api/...)
                                                    ├─► MongoDB Atlas
                                                    ├─► Cloudinary (ảnh, PDF xuất nhật ký)
                                                    ├─► Gemini (AI văn bản)
                                                    └─► GET /models/manifest.json (đọc từ service web)
```

Cấu hình nằm ở `vercel.json` ở gốc repo.

## Những gì đã chỉnh để chạy được trên Vercel

| Giới hạn của Vercel | Cách xử lý trong code |
|---|---|
| Request/response tối đa ~4,5 MB | Trình duyệt tự nén ảnh xuống ≤ 4 MB trước khi gửi (`core/utils/upload-image.ts`). Ảnh phục hồi > 4 MB được đổi sang JPEG (`fitPicture`). PDF tải thẳng từ Cloudinary bằng link hết hạn sau 5 phút. |
| Không có đĩa lưu lâu dài | Mọi tệp lưu qua `StorageService` lên Cloudinary (thư mục `exports` cho PDF, lưu dạng raw). |
| Tiến trình dừng ngay sau khi trả lời | Việc chạy ngầm (dựng PDF, gửi thư) đi qua `runInBackground`, dùng `waitUntil`. |
| Không có trình duyệt cài sẵn | Dựng PDF bằng `@sparticuz/chromium` + `playwright-core`. Gói Chromium tải về `/tmp` lúc chạy (biến `CHROMIUM_PACK_URL`). Font Noto Sans tải từ Google Fonts. |
| Preset NestJS cần `app.listen` | `src/main.ts` nghe cổng `process.env.PORT`. Chạy trên máy thì dùng `API_PORT`. |
| Hai service đóng gói riêng | `ModelLibraryService` không thấy manifest trên đĩa thì tải từ `https://$VERCEL_URL/models/manifest.json`. Không được thì thử `WEB_ORIGIN`. |

## Lộ trình

### Bước 0. Chuẩn bị tài khoản

1. Tạo tài khoản Vercel, kết nối GitHub chứa repo `Duongo16/CAP_Petmory`.
2. Chọn gói:
   - **Hobby (miễn phí):** chỉ dùng phi thương mại, đủ cho demo và nghiệm thu.
   - **Pro:** cần khi chạy thật.

### Bước 1. Mở MongoDB Atlas cho Vercel

1. Atlas → **Network Access** → **Allow access from anywhere** (`0.0.0.0/0`). Vercel không có IP cố định.
2. Atlas → **Database Access** → tạo user riêng cho bản deploy (ví dụ `petmory-vercel`), quyền `readWrite`, mật khẩu dài và ngẫu nhiên.
3. Lấy chuỗi `mongodb+srv://...` để dùng ở Bước 3.

### Bước 2. Import project

1. Vercel → **Add New → Project** → chọn repo `CAP_Petmory`.
2. Vercel đọc `vercel.json` và hiện hai service `api` và `web`. Giữ nguyên, **không** dán `vercel.json` gợi ý nào khác.
3. Root Directory để trống (gốc repo).
4. **Chưa bấm Deploy.** Khai biến môi trường ở Bước 3 trước.
5. Sau khi tạo project, vào Settings:
   - **General → Node.js Version:** chọn `22.x`.
   - **Functions → Function Region:** chọn `Singapore (sin1)`, gần Việt Nam và gần Atlas nếu cluster ở châu Á.

### Bước 3. Khai biến môi trường (Settings → Environment Variables)

Biến môi trường dùng chung cho mọi service trong project. Nhóm bắt buộc:

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` (ẩn nút đăng nhập nhanh tài khoản mẫu). Khi demo nghiệm thu mà cần nút này thì đặt `development`. |
| `MONGODB_URI` | Chuỗi kết nối từ Bước 1 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Hai chuỗi ngẫu nhiên khác nhau, mỗi chuỗi ≥ 32 ký tự. Tạo bằng `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Giữ như `.env` |
| `WEB_ORIGIN` | `https://<tên-miền>`, ví dụ `https://cap-petmory.vercel.app` |
| `STORAGE_DRIVER` | `cloudinary` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_SIGNED_URL_TTL` | Như `.env` |
| `UPLOAD_DIR` | `/tmp/uploads` |
| `UPLOAD_MAX_SIZE_MB` | `10` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | Khoá Gemini |
| `AI_TIMEOUT_MS` | `45000` |
| `SEPAY_WEBHOOK_KEY` | Khoá webhook SePay. **Không** dùng giá trị mẫu. |

Nhóm tuỳ chọn:

| Biến | Khi nào cần |
|---|---|
| `AI_MODEL`, `AI_IMAGE_PROVIDER`, `AI_IMAGE_MODEL` | Đổi model AI. Để trống thì dùng mặc định. |
| `SEPAY_API_BASE`, `SEPAY_API_TOKEN`, `SEPAY_ALLOWED_IPS`, `SEPAY_TIMEOUT_MS` | Nếu đang dùng ở `.env` |
| `SMTP_*` | Chức năng "Quên mật khẩu" khi `NODE_ENV=production` |
| `CHROMIUM_PACK_URL` | Chỉ khai khi muốn tải gói Chromium từ nơi khác |

Không khai `API_PORT` và `PORT`, vì Vercel tự đặt.

### Bước 4. Deploy

- **Qua Git (khuyên dùng):** bấm **Deploy**. Mỗi lần push nhánh chính sẽ tự deploy production, còn các nhánh khác tạo bản preview.
- **Bằng CLI:** `npm i -g vercel` (bản ≥ 48.4) → `vercel login` → `vercel link` → `vercel --prod`.

Log build phải có hai phần, một cho mỗi service: NestJS (`api`) và `Application bundle generation complete` (`web`).

### Bước 5. Sau khi có tên miền

1. Sửa `WEB_ORIGIN` cho đúng tên miền thật, rồi **Redeploy**.
2. SePay → webhook URL `https://<tên-miền>/api/payments/webhook`, header `Authorization: Apikey <SEPAY_WEBHOOK_KEY>`.
3. Gắn tên miền riêng (tuỳ chọn) ở Settings → Domains, rồi lặp lại mục 1–2.
4. Bản preview có bật Deployment Protection có thể chặn API tải manifest qua `VERCEL_URL`. Khi đó API tự chuyển sang dùng `WEB_ORIGIN`.

### Bước 6. Kiểm tra sau deploy

| # | Việc kiểm | Kỳ vọng |
|---|---|---|
| 1 | `https://<tên-miền>/api/catalog/packaging` | Trả JSON. Lần đầu có thể chậm vài giây (khởi động lạnh). |
| 2 | `https://<tên-miền>/shop`, tải lại trang (F5) | Không lỗi 404 |
| 3 | Vercel → Logs của service `api` | Có dòng `Thu vien mo hinh: 16 mau nen, 6 vung` |
| 4 | Đăng ký, đăng nhập, tạo hồ sơ bé | Thành công |
| 5 | Tải ảnh 10–15 MB từ điện thoại | Lên được (tự nén ≤ 4 MB) |
| 6 | Studio → Dựng mẫu từ ảnh | Nhận ra loài và màu, mở bước Chọn mẫu |
| 7 | Phục hồi ảnh với "Tách nền" | Chạy được |
| 8 | Nhật ký → Xuất PDF → Tải về | Có file PDF, chữ có dấu hiện đúng. Lần đầu chậm hơn vì phải tải gói Chromium. |
| 9 | Đặt hàng → SePay báo về | Đơn chuyển sang đã thanh toán |
| 10 | Đăng nhập quanly@ vào trang quản trị | Vào được bàn điều phối |

## Khi gặp lỗi

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Mọi `/api` trả 500, log ghi `MongoServerSelectionError` hoặc TLS alert 80 | Atlas chưa mở IP | Bước 1.1 |
| Log ghi `Missing required environment variable: ...` | Thiếu biến bắt buộc | Bước 3, rồi Redeploy |
| Log ghi `Khong tim thay ban khai mo hinh` | API không tải được manifest | Kiểm `WEB_ORIGIN` và Deployment Protection |
| 413 `FUNCTION_PAYLOAD_TOO_LARGE` | Tệp trên 4,5 MB đi qua API | Báo lại kèm đường dẫn API bị lỗi |
| 504 khi xuất PDF dài | Vượt thời gian chạy tối đa của hàm | Tăng Max Duration ở Settings → Functions (tối đa theo gói) |
| Gọi API báo CORS | `WEB_ORIGIN` sai tên miền | Sửa và Redeploy |
| PDF không dựng được, log ghi lỗi Chromium | Không tải được gói Chromium | Kiểm `CHROMIUM_PACK_URL`, hoặc kiểm mạng của hàm |
