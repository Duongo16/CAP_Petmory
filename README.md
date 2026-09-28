# PETMORY

Website lưu giữ kỷ niệm thú cưng bằng sản phẩm thủ công tùy biến.

**Stack:** NestJS · Angular 20 · MongoDB · Angular Material
**Phạm vi hiện tại:** Giai đoạn 1, mức chạy thử và trình diễn.

---

## Chạy dự án

Yêu cầu: Node 20 trở lên, Docker Desktop đang chạy.

```bash
npm install          # cài dependency cho cả hai ứng dụng
cp .env.example .env # tạo file cấu hình, đổi hai khóa JWT
npm run db:up        # khởi động MongoDB (replica set một nút)
npm run seed         # nạp dữ liệu mẫu
npm run dev          # chạy song song API và web
```

| Địa chỉ | Mô tả |
|---|---|
| http://localhost:4200 | Giao diện người dùng |
| http://localhost:3000/api | API |
| http://localhost:8081 | Xem trực tiếp dữ liệu trong MongoDB |

**Tài khoản nội bộ mẫu** — mật khẩu đều là `Petmory@2026`, đổi ngay trước khi dùng thật:

| Tài khoản | Nhóm quyền |
|---|---|
| `quanly@petmory.local` | Quản lý và Quản trị — toàn quyền |
| `xuong@petmory.local` | Quản trị — điều phối đơn, không sửa được tham số |
| `cskh@petmory.local` | Chăm sóc khách hàng — chỉ xem |

### Lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run api` | Chỉ chạy backend, có theo dõi thay đổi |
| `npm run web` | Chỉ chạy frontend |
| `npm run build` | Biên dịch cả hai ứng dụng |
| `npm run db:down` | Dừng MongoDB |
| `npm run docs:contracts` | Sinh lại file hợp đồng dạng Word |
| `node tools/inspect-glb.js` | Đọc tệp mô hình 3D, đếm vùng vật liệu và số đỉnh |
| `node tools/test-studio-full-ui.js` | Chạy kiểm thử luồng tùy biến trên trình duyệt thật |
| `npm run db:check` | Kiểm tra cơ sở dữ liệu đang trỏ tới đâu và chỉ mục đã đủ chưa |
| `npm run test:integration` | Chạy 132 mục kiểm thử tích hợp |

---

## Cấu trúc

```
apps/
  api/                    NestJS
    src/common/           hằng số, guard, bộ lọc lỗi, nhật ký kiểm toán
    src/config/           đọc biến môi trường
    src/modules/
      auth/               đăng ký, đăng nhập, làm mới phiên
      users/              tài khoản và hạn mức riêng
      pets/               hồ sơ thú cưng
      catalog/            mã màu, loại sản phẩm, kích cỡ
      business-config/    tham số nghiệp vụ do Quản lý cấu hình
    src/seed/             dữ liệu mẫu
  web/                    Angular
    src/app/core/         mô hình, dịch vụ, guard, interceptor
    src/app/features/     màn hình theo tính năng
    src/app/layout/       khung giao diện chung
    public/i18n/          tệp ngôn ngữ
tools/                    bộ kiểm thử và bộ quét tự động
  integration/            sáu kịch bản kiểm thử tích hợp
```

Tài liệu nghiệp vụ, hợp đồng và hướng dẫn được giữ **bên ngoài kho mã**, nên lệnh
`npm run docs:contracts` chỉ chạy được ở nơi có thư mục tài liệu.

---

## Bốn quy ước bắt buộc

**1. Tiền dùng kiểu thập phân chính xác.** Mọi giá trị tiền lưu bằng `Decimal128` trong MongoDB và trả về cho giao diện dưới dạng `{ "$numberDecimal": "450000" }`. Không dùng kiểu số của JavaScript cho tiền vì sẽ sai số khi cộng trừ. Giao diện chỉ định dạng lại để hiển thị, không tính toán lại.

**2. Kiểm tra quyền trên từng tài nguyên.** Không chỉ kiểm tra vai trò. Hồ sơ thú cưng của người khác trả về lỗi không tìm thấy thay vì lỗi không có quyền, để không lộ sự tồn tại của bản ghi.

**3. Không xóa cứng dữ liệu nghiệp vụ.** Hồ sơ thú cưng dùng cờ ẩn. Mọi thao tác chạm tới cấu hình và dữ liệu khách đều ghi nhật ký kiểm toán.

**4. Không viết chữ cứng trong giao diện.** Toàn bộ chữ đi qua tệp ngôn ngữ. Màu sắc khai báo thành biến dùng chung trong `styles.scss`, không viết mã màu trực tiếp trong từng màn hình.

---

## Trình xem 3D

Trang **Tùy biến 3D** tại `/studio` chạy theo luồng ba bước: Chọn mẫu, Ngoại hình, Hoàn tất.

- Xoay 360 độ bằng kéo chuột hoặc chạm, phóng to bằng lăn chuột
- Sáu góc chuẩn: trước, trái, phải, sau, trên, chéo; tự xoay bật tắt được
- **Tô màu trực tiếp lên mô hình**: đổ cả mảng hoặc quét bằng cọ chỉnh được cỡ, hoàn tác tới 30 bước
- Chụp bộ ảnh tĩnh sáu góc cho hồ sơ sản xuất
- Có phương án dự phòng khi thiết bị không chạy được đồ họa ba chiều

Trình xem **đọc vùng vật liệu trực tiếp từ tệp mô hình**, không viết cứng tên vùng.
Tệp `apps/web/public/models/manifest.json` chỉ gán nhãn hiển thị và nhóm màu cho phép.
Nhờ vậy mô hình mới thay vào là chạy ngay, không phải sửa mã nguồn.

## Việc tiếp theo

Tình trạng đầy đủ và danh sách việc còn lại nằm trong bộ tài liệu giữ bên ngoài kho mã.

Việc gấp nhất không nằm trong mã nguồn: **cài Blender, bỏ lớp ảnh phủ và chia sáu vùng
vật liệu cho mô hình mèo và chó, rồi tạo tư thế ngồi và nằm.** Chạy `npm run test:models`
để xem mô hình hiện tại còn thiếu những gì.

Mô hình dùng bộ **Kenney Cube Pets**, giấy phép CC0. Dáng khối vuông đầu to hợp với sản phẩm len chọc, và có sẵn cả mèo lẫn chó. Hiện tại mỗi mô hình chỉ có một vùng vật liệu nên đổi màu còn nhuộm cả con; xử lý xong trong Blender là đổi màu theo từng vùng.
