# Giấy phép mô hình 3D

Các tệp `.glb` trong thư mục này thuộc bộ **Cube Pets 2.0** của tác giả **Kenney**.

| Thuộc tính | Nội dung |
|---|---|
| Tác giả | Kenney |
| Trang chính thức | https://kenney.nl/assets/cube-pets |
| Giấy phép | **CC0 1.0 Universal** (hiến tặng vào miền công cộng) |
| Toàn văn giấy phép | https://creativecommons.org/publicdomain/zero/1.0/ |
| Cho phép dùng thương mại | Có |
| Bắt buộc ghi nguồn | Không, nhưng tác giả khuyến khích ghi "Kenney" hoặc "www.kenney.nl" |
| Số mô hình trong bộ gốc | 24 con, **có sẵn cả mèo và chó** |
| Ngày tải | 25/09/2026 |

Bản giấy phép gốc do tác giả phát hành kèm theo được lưu tại `Kenney-License.txt`.
Tệp này là bằng chứng giấy phép theo khoản 6.3 Hợp đồng dịch vụ.

## Tệp hiện có

| Tệp | Loài | Dùng cho |
|---|---|---|
| `animal-cat.glb` | Mèo | Mẫu nền chính, sẽ tạo hai tư thế |
| `animal-dog.glb` | Chó | Mẫu nền chính, sẽ tạo hai tư thế |
| `animal-bunny.glb` | Thỏ | Dự phòng cho giai đoạn sau |
| `animal-fox.glb` | Cáo | Dự phòng cho giai đoạn sau |
| `animal-panda.glb` | Gấu trúc | Dự phòng cho giai đoạn sau |
| `animal-tiger.glb` | Hổ | Dự phòng cho giai đoạn sau |
| `Textures/colormap.png` | — | Bảng màu dùng chung cho toàn bộ mô hình |

## Trạng thái kỹ thuật

Các tệp hiện tại **là bản gốc chưa qua Blender**. Mỗi mô hình chỉ có
**một vùng vật liệu** tên `colormap` dùng ảnh texture chung, nên đổi màu trên web
sẽ nhuộm toàn bộ con vật kể cả mắt.

Việc cần làm để đổi màu theo vùng: bỏ texture và chia sáu vùng vật liệu trong Blender.
Xem `docs/HUONG-DAN-BLENDER.md`.

Chạy `node tools/phan-tich-glb.js` để xem lại chi tiết từng tệp.

## Vì sao đổi từ bộ Quaternius sang bộ này

Bộ Quaternius trước đó có ưu điểm là sẵn 4 đến 6 vùng vật liệu độc lập và không dùng
texture, rất hợp cho việc đổi màu. Nhưng tỉ lệ các con vật là tỉ lệ thật, thân dài,
không hợp với dáng sản phẩm len chọc vốn đầu to thân tròn. Bộ đó cũng không có mèo,
phải chỉnh sửa con cáo thành mèo.

Bộ Kenney ngược lại: dáng khối vuông đầu to đúng chất len chọc, có sẵn cả mèo lẫn chó,
nhưng phải bỏ texture và chia lại vùng vật liệu. Khối lượng Blender tương đương,
đổi lại được đúng dáng sản phẩm và không phải chế ra con mèo.
