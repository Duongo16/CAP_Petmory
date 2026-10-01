/**
 * Ve anh minh hoa cho cac mon hang co san.
 *
 * Hang co san la do dung va do luu niem, khong phai mo hinh thu cung, nen
 * khong dung duoc bo mo hinh ba chieu nhu anh trang chu. O day moi mon duoc
 * ve bang hinh phang tren dung bang mau cua thuong hieu, khong tai bat cu
 * thu gi tu ben ngoai ve.
 *
 * Chay: node tools/make-goods-images.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'demo', 'goods');
const SIZE = 900;

/** Mot mon hang can ve, kem tong mau nen. */
const PICTURES = [
  { name: 'collar', tone: 'blush' },
  { name: 'bowl', tone: 'cream' },
  { name: 'tag', tone: 'lilac' },
  { name: 'frame', tone: 'cream' },
  { name: 'giftbox', tone: 'blush' },
  { name: 'blanket', tone: 'lilac' },
];

/** Trang ve. Giu trong day de khong de lai tep thua nao phai don. */
function pageSource(jobs) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head>
<body><canvas id="stage" width="${SIZE}" height="${SIZE}"></canvas>
<script>
const JOBS = ${JSON.stringify(jobs)};
const SIZE = ${SIZE};
const canvas = document.getElementById('stage');
const brush = canvas.getContext('2d');

const TONE = {
  cream: ['#fffaf6', '#fff1ea', '#f6ddcd'],
  blush: ['#fff4ee', '#fdeae0', '#f2d3c2'],
  lilac: ['#faf2ff', '#f0dbff', '#dcc2f0'],
};

const WOOL = '#c98a4b';
const WOOL_DARK = '#a86d33';
const PLUM = '#7c4a86';
const PLUM_DARK = '#5d3566';
const CREAMY = '#fdf6ec';
const INK = '#3a2d22';
const LEAF = '#4f7f68';

/** Nen: mot quang sang toa tron o giua roi toi dan ra ria. */
function wash(tone) {
  const glow = brush.createRadialGradient(SIZE / 2, SIZE * 0.42, 40, SIZE / 2, SIZE / 2, SIZE * 0.66);
  glow.addColorStop(0, TONE[tone][0]);
  glow.addColorStop(0.55, TONE[tone][1]);
  glow.addColorStop(1, TONE[tone][2]);
  brush.fillStyle = glow;
  brush.fillRect(0, 0, SIZE, SIZE);
}

/** Bong do mem duoi mon do, de no khong lo lung tren nen. */
function groundShadow(x, y, wide, tall) {
  brush.save();
  brush.globalAlpha = 0.18;
  brush.fillStyle = '#4a2c1e';
  brush.beginPath();
  brush.ellipse(x, y, wide, tall, 0, 0, Math.PI * 2);
  brush.fill();
  brush.restore();
}

/** Van soi len: nhung net cong ngan chong len nhau. */
function woolGrain(x, y, radius, tint) {
  brush.save();
  brush.strokeStyle = tint;
  brush.globalAlpha = 0.5;
  brush.lineWidth = 3;
  for (let i = 0; i < 60; i += 1) {
    const angle = (i / 60) * Math.PI * 2;
    const far = radius * (0.5 + Math.random() * 0.45);
    brush.beginPath();
    brush.arc(x + Math.cos(angle) * far, y + Math.sin(angle) * far, 9 + Math.random() * 7,
      angle, angle + Math.PI * 1.2);
    brush.stroke();
  }
  brush.restore();
}

function rounded(x, y, wide, tall, radius) {
  brush.beginPath();
  brush.moveTo(x + radius, y);
  brush.arcTo(x + wide, y, x + wide, y + tall, radius);
  brush.arcTo(x + wide, y + tall, x, y + tall, radius);
  brush.arcTo(x, y + tall, x, y, radius);
  brush.arcTo(x, y, x + wide, y, radius);
  brush.closePath();
}

/** Vong co len, kem khoa va the ten. */
function collar() {
  groundShadow(SIZE / 2, SIZE * 0.78, SIZE * 0.3, SIZE * 0.05);
  brush.save();
  brush.lineWidth = 58;
  brush.strokeStyle = WOOL;
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.46, SIZE * 0.27, 0, Math.PI * 2);
  brush.stroke();
  brush.lineWidth = 16;
  brush.strokeStyle = WOOL_DARK;
  brush.globalAlpha = 0.45;
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.46, SIZE * 0.27, Math.PI * 0.15, Math.PI * 0.85);
  brush.stroke();
  brush.restore();
  woolGrain(SIZE / 2, SIZE * 0.46, SIZE * 0.27, CREAMY);

  brush.fillStyle = PLUM;
  rounded(SIZE / 2 - 46, SIZE * 0.17, 92, 58, 14);
  brush.fill();

  brush.fillStyle = CREAMY;
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.76, 46, 0, Math.PI * 2);
  brush.fill();
  brush.fillStyle = PLUM_DARK;
  brush.font = '600 34px sans-serif';
  brush.textAlign = 'center';
  brush.textBaseline = 'middle';
  brush.fillText('PM', SIZE / 2, SIZE * 0.76);
}

/** Bat an, nhin cheo tu tren xuong. */
function bowl() {
  groundShadow(SIZE / 2, SIZE * 0.72, SIZE * 0.3, SIZE * 0.06);
  brush.fillStyle = PLUM;
  brush.beginPath();
  brush.ellipse(SIZE / 2, SIZE * 0.55, SIZE * 0.31, SIZE * 0.2, 0, 0, Math.PI * 2);
  brush.fill();
  brush.fillStyle = PLUM_DARK;
  brush.beginPath();
  brush.ellipse(SIZE / 2, SIZE * 0.5, SIZE * 0.26, SIZE * 0.155, 0, 0, Math.PI * 2);
  brush.fill();
  brush.fillStyle = CREAMY;
  brush.beginPath();
  brush.ellipse(SIZE / 2, SIZE * 0.5, SIZE * 0.21, SIZE * 0.12, 0, 0, Math.PI * 2);
  brush.fill();

  brush.fillStyle = WOOL;
  for (let i = 0; i < 26; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const far = Math.random() * 0.8;
    brush.beginPath();
    brush.ellipse(
      SIZE / 2 + Math.cos(angle) * SIZE * 0.19 * far,
      SIZE * 0.5 + Math.sin(angle) * SIZE * 0.1 * far,
      15, 11, angle, 0, Math.PI * 2,
    );
    brush.fill();
  }
}

/** The ten khac, treo tren mot vong nho. */
function tag() {
  groundShadow(SIZE / 2, SIZE * 0.8, SIZE * 0.2, SIZE * 0.04);
  brush.save();
  brush.lineWidth = 16;
  brush.strokeStyle = '#b9a06b';
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.24, 52, 0, Math.PI * 2);
  brush.stroke();
  brush.restore();

  brush.fillStyle = '#d8b96a';
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.55, SIZE * 0.19, 0, Math.PI * 2);
  brush.fill();
  brush.fillStyle = '#c2a052';
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.57, SIZE * 0.155, 0, Math.PI * 2);
  brush.fill();

  brush.fillStyle = INK;
  brush.font = '600 52px serif';
  brush.textAlign = 'center';
  brush.textBaseline = 'middle';
  brush.fillText('Mochi', SIZE / 2, SIZE * 0.55);
  brush.font = '400 26px serif';
  brush.fillText('0901 234 567', SIZE / 2, SIZE * 0.62);
}

/** Khung anh go, ben trong la dau chan thu cung. */
function frame() {
  groundShadow(SIZE / 2, SIZE * 0.82, SIZE * 0.26, SIZE * 0.04);
  brush.fillStyle = '#a97c4f';
  rounded(SIZE * 0.24, SIZE * 0.18, SIZE * 0.52, SIZE * 0.6, 22);
  brush.fill();
  brush.fillStyle = '#8c6239';
  rounded(SIZE * 0.27, SIZE * 0.21, SIZE * 0.46, SIZE * 0.54, 16);
  brush.fill();
  brush.fillStyle = CREAMY;
  rounded(SIZE * 0.29, SIZE * 0.23, SIZE * 0.42, SIZE * 0.5, 10);
  brush.fill();

  brush.fillStyle = WOOL;
  const cx = SIZE / 2;
  const cy = SIZE * 0.52;
  brush.beginPath();
  brush.ellipse(cx, cy + 34, 66, 52, 0, 0, Math.PI * 2);
  brush.fill();
  for (const [dx, dy] of [[-62, -34], [-22, -58], [22, -58], [62, -34]]) {
    brush.beginPath();
    brush.ellipse(cx + dx, cy + dy, 22, 28, 0, 0, Math.PI * 2);
    brush.fill();
  }
}

/** Hop qua that no. */
function giftbox() {
  groundShadow(SIZE / 2, SIZE * 0.8, SIZE * 0.29, SIZE * 0.05);
  brush.fillStyle = CREAMY;
  rounded(SIZE * 0.24, SIZE * 0.38, SIZE * 0.52, SIZE * 0.38, 16);
  brush.fill();
  brush.fillStyle = '#f2e6d2';
  rounded(SIZE * 0.21, SIZE * 0.3, SIZE * 0.58, SIZE * 0.12, 14);
  brush.fill();

  brush.fillStyle = PLUM;
  brush.fillRect(SIZE * 0.455, SIZE * 0.3, SIZE * 0.09, SIZE * 0.46);
  brush.save();
  brush.fillStyle = PLUM_DARK;
  brush.beginPath();
  brush.ellipse(SIZE * 0.43, SIZE * 0.27, 62, 40, -0.4, 0, Math.PI * 2);
  brush.fill();
  brush.beginPath();
  brush.ellipse(SIZE * 0.57, SIZE * 0.27, 62, 40, 0.4, 0, Math.PI * 2);
  brush.fill();
  brush.fillStyle = PLUM;
  brush.beginPath();
  brush.arc(SIZE / 2, SIZE * 0.27, 26, 0, Math.PI * 2);
  brush.fill();
  brush.restore();
}

/** Chong chan ni gap goi. */
function blanket() {
  groundShadow(SIZE / 2, SIZE * 0.76, SIZE * 0.3, SIZE * 0.05);
  const bands = [
    { y: 0.58, tint: WOOL },
    { y: 0.48, tint: CREAMY },
    { y: 0.38, tint: LEAF },
  ];
  for (const band of bands) {
    brush.fillStyle = band.tint;
    rounded(SIZE * 0.22, SIZE * band.y, SIZE * 0.56, SIZE * 0.13, 18);
    brush.fill();
    brush.save();
    brush.globalAlpha = 0.25;
    brush.fillStyle = '#4a2c1e';
    rounded(SIZE * 0.22, SIZE * band.y + SIZE * 0.115, SIZE * 0.56, SIZE * 0.015, 8);
    brush.fill();
    brush.restore();
  }
  brush.save();
  brush.strokeStyle = PLUM;
  brush.lineWidth = 10;
  brush.globalAlpha = 0.6;
  for (let i = 0; i < 5; i += 1) {
    brush.beginPath();
    brush.moveTo(SIZE * 0.26 + i * SIZE * 0.11, SIZE * 0.39);
    brush.lineTo(SIZE * 0.26 + i * SIZE * 0.11, SIZE * 0.5);
    brush.stroke();
  }
  brush.restore();
}

const DRAW = { collar, bowl, tag, frame, giftbox, blanket };

const out = [];
for (const job of JOBS) {
  brush.clearRect(0, 0, SIZE, SIZE);
  wash(job.tone);
  DRAW[job.name]();
  out.push({ name: job.name, picture: canvas.toDataURL('image/png') });
}
window.results = out;
</script></body></html>`;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('VE ANH HANG CO SAN');
  console.log('='.repeat(60));

  await page.setContent(pageSource(PICTURES), { waitUntil: 'load' });
  await page.waitForFunction(() => window.results, { timeout: 60000 }).catch(() => {
    console.log('  Trang khong ve xong. Loi:', broken.slice(0, 3).join(' | '));
    throw new Error('khong ve duoc');
  });

  const results = await page.evaluate(() => window.results);
  await browser.close();

  let made = 0;
  for (const one of results) {
    const bytes = Buffer.from(one.picture.split(',')[1], 'base64');
    if (bytes.length < 4000) {
      console.log(`  ${one.name.padEnd(10)} TRONG: ${bytes.length} byte`);
      continue;
    }
    fs.writeFileSync(path.join(OUT, `${one.name}.png`), bytes);
    made += 1;
    console.log(`  ${one.name.padEnd(10)} ${(bytes.length / 1024).toFixed(0)} KB`);
  }

  console.log('-'.repeat(60));
  console.log(`${made}/${PICTURES.length} anh da ghi vao apps/web/public/demo/goods`);
  process.exit(made === PICTURES.length ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
