# Giấy phép mô hình 3D

Tệp này là bằng chứng giấy phép theo khoản 6.3 Hợp đồng dịch vụ. Thư mục có hai
loại giấy phép:

- **CC0 1.0** (miền công cộng): dùng thương mại được, không bắt buộc ghi nguồn.
- **CC-BY 3.0** (ghi công): dùng thương mại được, **bắt buộc ghi tên tác giả**.
  Trang Tùy biến 3D hiện tên tác giả, giấy phép và đường dẫn nguồn của mẫu đang
  chọn, ngay dưới danh sách mẫu. Danh mục `manifest.json` giữ thông tin này ở
  trường `credit` của từng mẫu, nên thêm mẫu mới phải điền đủ trường đó.
  Toàn văn: https://creativecommons.org/licenses/by/3.0/

Danh mục được chắt lọc ngày 04/10/2026: chỉ giữ thú cưng, ưu tiên dáng thật và
dáng ngồi hợp với tượng len. Ảnh thẻ trong `thumbs/` được chụp từ chính khung
xem 3D bằng `node tools/render-model-thumbs.js`.

## Mèo

| Tệp | Mẫu | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|---|
| `cat-sitting-ginger.glb` | Mèo mướp ngồi | elkiotbear | CC-BY 3.0 | https://poly.pizza/m/ovFy5UldDq |
| `cat-sitting-grey.glb` | Mèo xám ngồi | Corentin Fatus | CC-BY 3.0 | https://poly.pizza/m/axMUjC7xwSa |
| `cat-kitten-round.glb` | Mèo con tròn | jeremy | CC-BY 3.0 | https://poly.pizza/m/dXyLRVNOalM |
| `cat-siamese.glb` | Mèo Xiêm | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/dBJgGEu5bHW |

## Chó

| Tệp | Mẫu | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|---|
| `dog-puppy-sitting.glb` | Cún con ngồi | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/07qH3gO5K8L |
| `dog-golden-puppy.glb` | Cún lông vàng | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/3nFLBC3aXen |
| `dog-poodle.glb` | Poodle | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/eQmBaLcGbbE |
| `dog-beagle.glb` | Beagle | Poly by Google | CC-BY 3.0 | https://poly.pizza/m/0BnDT3T1wTE |
| `dog-corgi.glb` | Corgi | madtrollstudio | CC-BY 3.0 | https://poly.pizza/m/2neHxHTY3t |
| `q-Pug.glb` | Pug | Quaternius | CC0 1.0 | https://poly.pizza/m/1gXKv15ik8 |
| `q-ShibaInu.glb` | Shiba Inu | Quaternius | CC0 1.0 | https://poly.pizza/m/y4wdQpg767 |
| `q-Husky.glb` | Husky | Quaternius | CC0 1.0 | https://poly.pizza/m/wcWiuEqwzq |

Shiba, Husky và Cáo thuộc bộ Quaternius Ultimate Animated Animal Pack
(https://quaternius.com/packs/ultimateanimatedanimals.html). Các tệp này được lấy
từ bản sao công khai `trebeljahr/quaternius-showcase` trên GitHub; mã băm SHA-256
đã đối chiếu trùng khớp với bộ gốc.

## Thú khác

| Tệp | Mẫu | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|---|
| `q-Fox.glb` | Cáo nhỏ | Quaternius | CC0 1.0 | https://quaternius.com/packs/ultimateanimatedanimals.html |
| `animal-bunny.glb` | Thỏ (khối vuông) | Kenney | CC0 1.0 | https://kenney.nl/assets/cube-pets |
| `animal-panda.glb` | Gấu trúc (khối vuông) | Kenney | CC0 1.0 | https://kenney.nl/assets/cube-pets |
| `animal-parrot.glb` | Vẹt (khối vuông) | Kenney | CC0 1.0 | https://kenney.nl/assets/cube-pets |
| `animal-fish.glb` | Cá (khối vuông) | Kenney | CC0 1.0 | https://kenney.nl/assets/cube-pets |

Bản giấy phép gốc của Kenney được lưu tại `Kenney-License.txt`.

## Mẫu đã bỏ

Các mã dưới đây không còn trong danh mục. Bản thiết kế cũ vẫn giữ mã cũ; khi mở
lại, trang Tùy biến và phần gợi ý tự chuyển sang mẫu thay thế ghi ở trường
`retired` của `manifest.json`.

| Mã cũ | Lý do | Mẫu thay thế |
|---|---|---|
| `F-SHIBA-SOFT`, `F-SHIBA-ROUND` | Dáng len nắn xương, trùng tệp Shiba | `Q-SHIBA` (cùng tệp, màu đã tô giữ nguyên) |
| `F-HUSKY-SOFT`, `F-HUSKY-ROUND` | Như trên | `Q-HUSKY` (cùng tệp) |
| `F-FOX-ROUND` | Như trên | `Q-FOX` (cùng tệp) |
| `F-WOLF-ROUND`, `Q-WOLF` | Sói, không phải thú cưng | `Q-HUSKY` |
| `Q-DEER` | Hươu, không phải thú cưng | `Q-FOX` |
| `TEMP-CAT`, `TEMP-TIGER` | Đã có mèo dáng thật | `CAT-SIT-GINGER` |
| `TEMP-DOG` | Đã có chó dáng thật | `DOG-PUPPY-SIT` |
| `TEMP-FOX` | Trùng cáo dáng thật | `Q-FOX` |

Chất len của mọi mẫu giờ đến từ vật liệu trong khung xem, không còn nắn xương.

## Trạng thái kỹ thuật

| Nhóm | Đổi màu theo vùng |
|---|---|
| Mèo mướp, mèo xám, mèo con, cún con ngồi, Pug, Shiba, Husky, Cáo | Được: vật liệu đã chia theo vùng |
| Mèo Xiêm, Poodle, Beagle, Corgi, cún lông vàng | Màu nằm trong ảnh phủ: đổ màu theo từng mảng hoặc tô bằng cọ |
| Bộ Kenney | Màu nằm trong ảnh phủ, như trên |

Một số tệp quay mặt sang bên; trường `rotateY` trong danh mục xoay lại cho mọi
con nhìn về phía trước.

Chạy `node tools/inspect-glb.js apps/web/public/models` để xem lại chi tiết từng tệp.
