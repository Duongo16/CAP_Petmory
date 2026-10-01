/**
 * Doc bang mau tu tep logo.
 *
 * Gom cac diem anh lai thanh tung o mau roi xep theo so diem, de biet mau nao
 * that su chiem cho tren logo chu khong phai doan bang mat. Vung lay mau bo
 * phan vien ngoai va phan huy hieu o dinh, vi hai cho do khong thuoc nhan
 * dien cua thuong hieu.
 *
 * Chay: node tools/logo-colours.js
 */
const path = require('path');
const sharp = require('sharp');

const LOGO = path.join(__dirname, '..', 'CAP_Petmory', 'apps', 'web', 'public', 'img', 'logo.jpg');

/** Bao nhieu o mau tren mot truc. Cang nho thi cac sac gan nhau cang gop lai. */
const STEP = 24;

/** Bo qua o mau nao chiem it hon muc nay. */
const FLOOR = 0.004;

/** Chuyen ba so mau sang chuoi sau chu. */
function asHex(r, g, b) {
  const one = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${one(r)}${one(g)}${one(b)}`;
}

/** Do sang cam nhan duoc, dung de xep mau tu nhat den dam. */
function brightness(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Do bao hoa, dung de tach mau nen nhat ra khoi mau thuong hieu. */
function saturation(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  return high === 0 ? 0 : (high - low) / high;
}

/** Goc mau, dung de goi ten mot mau la cam, vang hay xanh la. */
function hue(r, g, b) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const span = high - low;
  if (span === 0) {
    return 0;
  }
  let deg = 0;
  if (high === r) {
    deg = ((g - b) / span) % 6;
  } else if (high === g) {
    deg = (b - r) / span + 2;
  } else {
    deg = (r - g) / span + 4;
  }
  return (deg * 60 + 360) % 360;
}

async function run() {
  const whole = sharp(LOGO);
  const meta = await whole.metadata();

  /*
   * Chi lay phan giua. Vien ngoai la hoa tiet trang tri, dinh anh la huy hieu
   * cua truong, va goc duoi ben phai co so trang.
   */
  const inset = Math.round(meta.width * 0.12);
  const top = Math.round(meta.height * 0.16);
  const region = {
    left: inset,
    top,
    width: meta.width - inset * 2,
    height: Math.round(meta.height * 0.74),
  };

  const { data, info } = await sharp(LOGO)
    .extract(region)
    .resize(360, 360, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bucket = new Map();
  const total = info.width * info.height;
  for (let at = 0; at < data.length; at += info.channels) {
    const r = data[at];
    const g = data[at + 1];
    const b = data[at + 2];
    const key = [
      Math.round(r / STEP) * STEP,
      Math.round(g / STEP) * STEP,
      Math.round(b / STEP) * STEP,
    ].join(',');
    const now = bucket.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    now.r += r;
    now.g += g;
    now.b += b;
    now.n += 1;
    bucket.set(key, now);
  }

  const rows = [...bucket.values()]
    .filter((one) => one.n / total >= FLOOR)
    .map((one) => {
      const r = one.r / one.n;
      const g = one.g / one.n;
      const b = one.b / one.n;
      return {
        hex: asHex(r, g, b),
        share: one.n / total,
        light: brightness(r, g, b),
        sat: saturation(r, g, b),
        hue: hue(r, g, b),
      };
    })
    .sort((a, b) => b.share - a.share);

  console.log('BANG MAU DOC TU LOGO');
  console.log('='.repeat(62));
  console.log('ma mau    phan tram  do sang  bao hoa  goc mau');
  for (const one of rows) {
    console.log(
      `${one.hex}   ${(one.share * 100).toFixed(1).padStart(5)}%   ` +
        `${one.light.toFixed(2)}     ${one.sat.toFixed(2)}     ${Math.round(one.hue)}`,
    );
  }

  console.log('');
  console.log('CAC MAU CO SAC RO NHAT, XEP THEO CHO CHIEM');
  console.log('-'.repeat(62));
  for (const one of rows.filter((x) => x.sat >= 0.28).slice(0, 10)) {
    console.log(`${one.hex}  ${(one.share * 100).toFixed(1).padStart(5)}%  goc mau ${Math.round(one.hue)}`);
  }
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
