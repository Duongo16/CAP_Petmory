/**
 * Kiem thu tai anh tu may len (muc 3, 7).
 *
 * Anh chup bang dien thoai doi moi thuong nang hon gioi han cua may chu, anh
 * tai tren mang hay o dang WebP, con anh iPhone o dang HEIC ma trinh duyet
 * khong doc duoc. Trinh duyet phai tu thu nho va doi dang de anh len duoc, va
 * khi that su khong doc duoc thi phai noi ro ly do chu khong bao loi chung.
 * Run: node tools/test-upload-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');
const sharp = require('sharp');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `upload.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const SEND = 'mat-dialog-container .strong';
const SERVER_LIMIT = 10 * 1024 * 1024;

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Anh nhieu hat lon nhu anh 48 MP, nen kem nen tep van nang hon gioi han. */
async function heavyPhoto() {
  const width = 6000;
  const height = 4500;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 2654435761) >>> 24;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 80 }).toBuffer();
}

/** Chon tep o o them anh, qua hop sua anh roi bam gui. */
async function sendThroughDialog(page, file) {
  await page.locator('#album-file').setInputFiles(file);
  await page.waitForSelector(SEND, { timeout: 15000 });
  await page.waitForFunction((sel) => !document.querySelector(sel)?.disabled, SEND, { timeout: 30000 });
  await page.locator(SEND).click();
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('PHOTO UPLOAD FROM DEVICE TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Tai anh test' } })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Mit', kind: 'DOG' } })).json();
    const count = async () => (await (await api.get(`${API}/pet-photos?pet=${pet._id}`, { headers: auth })).json()).length;

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#studio-pet', { timeout: 40000 });
    await page.selectOption('#studio-pet', pet._id);
    await page.waitForSelector('#album-file', { state: 'attached', timeout: 20000 });
    res.push(check('The picker lets every image format through', (await page.locator('#album-file').getAttribute('accept')) === 'image/*'));

    // --- Anh qua nang: tu thu nho roi moi gui ---
    const heavy = await heavyPhoto();
    await sendThroughDialog(page, { name: 'IMG_48MP.jpg', mimeType: 'image/jpeg', buffer: heavy });
    for (let i = 0; i < 30 && (await count()) < 1; i += 1) {
      await page.waitForTimeout(1000);
    }
    res.push(check('A photo over the server limit still goes up', (await count()) === 1,
      `${(heavy.length / 1048576).toFixed(1)} MB`));
    const stored = (await (await api.get(`${API}/pet-photos?pet=${pet._id}`, { headers: auth })).json())[0];
    res.push(check('The stored copy fits under the server limit', stored && stored.fileSize > 0 && stored.fileSize < SERVER_LIMIT,
      `${((stored?.fileSize ?? 0) / 1048576).toFixed(1)} MB`));

    // --- Anh WebP: doi sang JPG roi gui ---
    const webp = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#c8742f' } }).webp().toBuffer();
    await sendThroughDialog(page, { name: 'tai-ve.webp', mimeType: 'image/webp', buffer: webp });
    for (let i = 0; i < 20 && (await count()) < 2; i += 1) {
      await page.waitForTimeout(1000);
    }
    res.push(check('A WebP photo is converted and goes up', (await count()) === 2));

    // --- Anh trinh duyet khong doc duoc: noi ro ly do ---
    const fake = Buffer.alloc(200000, 7);
    fake.write('ftypheic', 4);
    await sendThroughDialog(page, { name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: fake });
    await page.waitForSelector('[role="alert"]', { timeout: 15000 });
    const said = (await page.locator('[role="alert"]').first().innerText()).trim();
    res.push(check('An unreadable HEIC photo explains why', said.includes('HEIC'), said.slice(0, 80)));
    res.push(check('The unreadable photo is not stored', (await count()) === 2));
    await page.screenshot({ path: path.join(OUT, 'upload-heic.png') });

    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
    await api.dispose();
  }
  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
