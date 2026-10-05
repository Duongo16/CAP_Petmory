# Giấy phép mô hình 3D

Tệp này là bằng chứng giấy phép theo khoản 6.3 Hợp đồng dịch vụ. Thư mục có hai
loại giấy phép:

- **CC0 1.0** (miền công cộng): dùng thương mại được, không bắt buộc ghi nguồn.
- **CC-BY 3.0** (ghi công): dùng thương mại được, **bắt buộc ghi tên tác giả**.
  Trang Tùy biến 3D hiện tên tác giả, giấy phép và đường dẫn nguồn của mẫu đang
  chọn, ngay dưới danh sách mẫu. Danh mục `manifest.json` giữ thông tin này ở
  trường `credit` của từng mẫu, nên thêm mẫu mới phải điền đủ trường đó.
  Toàn văn: https://creativecommons.org/licenses/by/3.0/

Danh mục được chắt lọc ngày 04/10/2026: chỉ giữ thú cưng, ưu tiên dáng thật.
Ảnh thẻ trong `thumbs/` được chụp từ chính khung xem 3D bằng
`node tools/render-model-thumbs.js`. Hiện chưa có mèo: bốn mẫu mèo thêm cùng
ngày đã bị bỏ sau khi xem thử.

## Bốn mẫu nền theo mục 6 và sáu phụ kiện (tự dựng, CC0 1.0)

Petmory tự dựng bằng `node tools/build-base-models.mjs` (three.js), nên thuộc miền
công cộng và không cần ghi nguồn. Mỗi mẫu chia đúng sáu vùng vật liệu
(`PM_FUR_MAIN`, `PM_FUR_SECONDARY`, `PM_EARS`, `PM_TAIL`, `PM_EYES`, `PM_NOSE`), có
bốn điểm neo phụ kiện (`PM_ANCHOR_HEAD`, `PM_ANCHOR_FACE`, `PM_ANCHOR_NECK`,
`PM_ANCHOR_BACK`) và hai bản: bản nhẹ cho điện thoại, bản `-full` cho xưởng.

| Tệp | Mẫu |
|---|---|
| `base-dog-standing.glb` / `-full.glb` | Cún đứng |
| `base-dog-sitting.glb` / `-full.glb` | Cún ngồi |
| `base-cat-sitting.glb` / `-full.glb` | Mèo ngồi |
| `base-cat-lying.glb` / `-full.glb` | Mèo nằm |
| `acc-knit-hat.glb`, `acc-bow.glb`, `acc-collar-tag.glb`, `acc-scarf.glb`, `acc-round-glasses.glb`, `acc-cape.glb` | Sáu phụ kiện dùng chung |

## Chó

| Tệp | Mẫu | Tác giả | Giấy phép | Nguồn |
|---|---|---|---|---|
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
| `TEMP-CAT`, `TEMP-TIGER` | Bỏ khỏi danh mục | Chưa có mèo thay thế, mở ra mẫu đầu danh sách |
| `CAT-SIT-GINGER`, `CAT-SIT-GREY`, `CAT-KITTEN`, `CAT-SIAMESE` | Bỏ sau khi xem thử | Như trên |
| `TEMP-DOG`, `DOG-PUPPY-SIT` | Bỏ sau khi xem thử | `DOG-GOLDEN` cho `TEMP-DOG`; `DOG-PUPPY-SIT` mở ra mẫu đầu danh sách |
| `TEMP-FOX` | Trùng cáo dáng thật | `Q-FOX` |

Khung xem hiển thị đúng vật liệu gốc của tệp, không thêm hiệu ứng len.

## Trạng thái kỹ thuật

| Nhóm | Đổi màu theo vùng |
|---|---|
| Pug, Shiba, Husky, Cáo | Được: vật liệu đã chia theo vùng |
| Poodle, Beagle, Corgi, cún lông vàng | Màu nằm trong ảnh phủ: đổ màu theo từng mảng hoặc tô bằng cọ |
| Bộ Kenney | Màu nằm trong ảnh phủ, như trên |

Tệp nào quay mặt sang bên thì dùng trường `rotateY` trong danh mục để xoay lại
cho nhìn về phía trước.

Chạy `node tools/inspect-glb.js apps/web/public/models` để xem lại chi tiết từng tệp.
