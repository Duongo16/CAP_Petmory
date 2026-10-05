/**
 * Kiem thu anh phuong an goi y thiet ke (SOW muc 15): tai anh cua be ngay tai
 * trang goi y, xin goi y, moi phuong an (toi da bon) co mot anh chup tu mo hinh
 * 3D to theo mau de xuat, chon mot phuong an thi sang buoc tuy bien.
 * Run: node tools/test-suggest-images-ui.js
 */
const { chromium, request } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `goiy.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-suggest-'));
  const file = path.join(tmp, 'be.jpg');
  const raw = Buffer.alloc(1200 * 900 * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * 29 + (i >> 5) * 13) % 255;
  }
  fs.writeFileSync(file, await sharp(raw, { raw: { width: 1200, height: 900, channels: 3 } }).jpeg().toBuffer());

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('SUGGESTION IMAGES TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Goi y test' } })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Na' } })).json();

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/suggest`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#suggest-upload', { state: 'attached', timeout: 30000 });

    await page.setInputFiles('#suggest-upload', file);
    await page.waitForSelector('.upload-note[role="status"]', { timeout: 20000 });
    const album = await (await api.get(`${API}/pet-photos?pet=${pet._id}`, { headers: auth })).json();
    res.push(check('A photo uploaded on the suggestion page lands in the pet album', album.length === 1, String(album.length)));

    await page.click('.ask-button');
    await page.waitForSelector('#suggest-options .option-card', { timeout: 90000 });
    const count = await page.locator('#suggest-options .option-card').count();
    res.push(check('Up to four options come back', count >= 1 && count <= 4, String(count)));
    await page.waitForFunction((n) => document.querySelectorAll('#suggest-options img.option-image').length === n, count, { timeout: 60000 })
      .catch(() => undefined);
    const images = await page.locator('#suggest-options img.option-image').evaluateAll((all) => all.map((img) => ({
      src: img.getAttribute('src') ?? '', width: img.naturalWidth,
    })));
    res.push(check('Every option shows an image rendered from the 3D model',
      images.length === count && images.every((one) => one.src.startsWith('data:image/png') && one.width >= 300),
      `${images.length}/${count}`));
    res.push(check('Option images differ when the colours differ',
      count < 2 || new Set(images.map((one) => one.src.length)).size > 1));
    await page.screenshot({ path: path.join(OUT, 'suggest-images.png'), fullPage: true });

    await page.locator('#suggest-options .option-card').first().click();
    await page.locator('.choose-button').click();
    await page.waitForURL('**/studio?draft=**', { timeout: 30000 });
    res.push(check('Choosing an option opens the customiser with the draft', true));
    res.push(check('No javascript error', errors.length === 0, errors.join(' | ').slice(0, 200)));
  } finally {
    await browser.close();
    await api.dispose();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 300));
  process.exit(1);
});
