/**
 * Cat cac tep nhan dien thuong hieu ra tu tep logo goc.
 *
 * Tep goc la mot trang trinh chieu vuong: co huy hieu cua truong o dinh, so
 * trang o goc duoi, va mot vien hoa tiet chay quanh. Khong tep nao trong so do
 * thuoc nhan dien cua thuong hieu, nen o day chi lay phan giua gom vong cung,
 * hai con vat va dong chu.
 *
 * Sinh ra ba tep: mot dau trang cho thanh dieu huong, mot dau vuong cho anh
 * dai dien, va mot dau nho cho bieu tuong tren the trinh duyet.
 *
 * Chay: node tools/make-logo.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'CAP_Petmory', 'apps', 'web', 'public', 'img', 'logo.jpg');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'img');

/**
 * Phan giua cua trang goc, tinh theo ti le.
 *
 * Do bang mat tren anh goc roi kiem lai bang cach mo tep da cat ra xem. Lay
 * theo ti le chu khong theo so diem anh, de doi tep goc khac kich thuoc thi
 * khong phai tinh lai.
 */
const MARK = { left: 0.075, top: 0.12, width: 0.865, height: 0.685 };

/** Rieng dong chu, dung cho dau nho tren the trinh duyet. */
const WORD = { left: 0.075, top: 0.565, width: 0.865, height: 0.235 };

async function cut(meta, box) {
  return {
    left: Math.round(meta.width * box.left),
    top: Math.round(meta.height * box.top),
    width: Math.round(meta.width * box.width),
    height: Math.round(meta.height * box.height),
  };
}

async function run() {
  if (!fs.existsSync(SOURCE)) {
    console.log('Khong tim thay tep logo goc.');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const meta = await sharp(SOURCE).metadata();
  console.log(`Tep goc: ${meta.width} nhan ${meta.height}`);

  /* Ban day du, dung o chan trang va cac cho can nhin ro ca hai con vat. */
  const full = path.join(OUT, 'logo.png');
  await sharp(SOURCE)
    .extract(await cut(meta, MARK))
    .resize(720, 720, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(full);
  console.log(`Ban day du: ${full}`);

  /* Ban vuong, dung lam anh dai dien khi chia se duong dan. */
  const square = path.join(OUT, 'logo-square.png');
  await sharp(SOURCE)
    .extract(await cut(meta, MARK))
    .resize(512, 512, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9 })
    .toFile(square);
  console.log(`Ban vuong: ${square}`);

  /* Ban nho, chi lay hai con vat, dung cho bieu tuong tren the trinh duyet. */
  const small = path.join(OUT, 'logo-mark.png');
  await sharp(SOURCE)
    .extract(
      await cut(meta, { left: 0.285, top: 0.19, width: 0.43, height: 0.375 }),
    )
    .resize(256, 256, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(small);
  console.log(`Ban nho: ${small}`);

  /* Dong chu rieng, giu lai de dung khi can mot dai chu nam ngang. */
  const word = path.join(OUT, 'logo-word.png');
  await sharp(SOURCE)
    .extract(await cut(meta, WORD))
    .resize(900, null, { fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toFile(word);
  console.log(`Dong chu: ${word}`);

  /* Tep goc, giu nguyen de con doi chieu ve sau. */
  fs.copyFileSync(SOURCE, path.join(OUT, 'logo.jpg'));
  console.log(`Tep goc da chep sang: ${path.join(OUT, 'logo.jpg')}`);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
