# Giấy phép mô hình 3D

Thư mục này chứa hai bộ mô hình, cả hai đều **CC0 1.0 Universal** (hiến tặng vào
miền công cộng): dùng thương mại được, không bắt buộc ghi nguồn. Tệp này là bằng
chứng giấy phép theo khoản 6.3 Hợp đồng dịch vụ.

## Bộ 1 — Kenney, Cube Pets 2.0 (dáng khối vuông)

| Thuộc tính | Nội dung |
|---|---|
| Tác giả | Kenney |
| Trang chính thức | https://kenney.nl/assets/cube-pets |
| Giấy phép | CC0 1.0 Universal |
| Toàn văn | https://creativecommons.org/publicdomain/zero/1.0/ |
| Số mô hình trong bộ gốc | 24 con, có sẵn cả mèo và chó |
| Tệp tải về | `kenney_cube-pets_1.0.zip` |
| Ngày tải lần đầu | 25/09/2026 |
| Ngày bổ sung | 30/09/2026 |

Bản giấy phép gốc do tác giả phát hành kèm theo được lưu tại `Kenney-License.txt`.

Tệp đang dùng: `animal-cat.glb`, `animal-dog.glb`, `animal-bunny.glb`,
`animal-fox.glb`, `animal-panda.glb`, `animal-tiger.glb`, `animal-parrot.glb`,
`animal-fish.glb`.

## Bộ 2 — Quaternius, Ultimate Animated Animal Pack (dáng thật)

| Thuộc tính | Nội dung |
|---|---|
| Tác giả | Quaternius |
| Trang chính thức | https://quaternius.com/packs/ultimateanimatedanimals.html |
| Giấy phép | CC0 |
| Số mô hình trong bộ gốc | 12 con: Alpaca, Bull, Cow, Deer, Donkey, Fox, Horse, Horse_White, Husky, ShibaInu, Stag, Wolf |
| Ngày tải lần đầu | 25/09/2026 |
| Ngày bổ sung | 30/09/2026 |

Tệp đang dùng: `q-ShibaInu.glb`, `q-Husky.glb`, `q-Fox.glb`, `q-Wolf.glb`,
`q-Deer.glb`.

**Đường lấy tệp.** Trang chính thức đưa về một thư mục Google Drive, không tải
bằng lệnh được. Các tệp được lấy từ bản sao công khai trên GitHub
(`trebeljahr/quaternius-showcase`, thư mục `public/glb/animals_pack`). Đã đối
chiếu mã băm SHA-256 của ba tệp đang dùng từ trước với bản sao này: **trùng khớp
từng byte**, nên bản sao đúng là bộ gốc chứ không phải bản đã chỉnh.

## Dáng len — không phải bộ thứ ba

Các mẫu "dáng len" trong danh mục **không có tệp mô hình riêng**. Chúng dùng lại
đúng tệp của bộ Quaternius, chỉ khác ở chỗ tỉ lệ một số xương được nắn lại lúc
hiển thị: đầu to hơn, thân tròn hơn, chân ngắn lại. Bảng hệ số nằm trong
`apps/web/src/app/shared/viewer-3d/body-shape.ts`.

Vì vậy dáng len không làm nặng thêm trang web và không phát sinh vấn đề giấy phép
nào mới.

## Trạng thái kỹ thuật

| Bộ | Vùng màu mỗi con | Dùng ảnh phủ | Đổi màu theo vùng |
|---|--:|---|---|
| Kenney Cube Pets | 1 | có | Không — nhuộm cả con, kể cả mắt |
| Quaternius | 4 đến 8 | không | Được ngay, không cần sửa gì |

Bộ Kenney muốn đổi màu theo vùng thì phải bỏ ảnh phủ và chia lại vùng vật liệu
trong Blender. Xem `docs/HUONG-DAN-BLENDER.md`.

Chạy `node tools/inspect-glb.js apps/web/public/models` để xem lại chi tiết từng tệp.

## Cái còn thiếu

Không bộ nào có **mèo dáng thật**. Bộ Quaternius chỉ có mười hai con kể trên,
không có mèo; bộ Kenney có mèo nhưng là dáng khối vuông. Đã tìm qua các nguồn
CC0 công khai khác (Kenney, Quaternius, KayKit, Sketchfab, Poly Pizza) và không
nguồn nào có sẵn mèo dáng thật dùng thương mại được. Ba hướng xử lý nằm trong
`docs/CHON-MAU-3D.md`.
