/**
 * Browser test of the standalone restoration screen.
 *
 * Run: node tools/test-restore-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });
const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `ph.${Date.now()}@petmory.local`;

/**
 * Waits for the development server to finish compiling.
 *
 * While it is rebuilding, an error overlay covers the page and swallows every
 * click, so a test would fail for a reason that has nothing to do with what it
 * is checking. A plain loop is used rather than waitForFunction, which has been
 * seen to hang here.
 */
async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 60 giay');
}

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) { failed += 1; }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function makePhoto() {
  const dots = [];
  for (let i = 0; i < 50; i += 1) {
    dots.push(`<circle cx="${(i * 41) % 700}" cy="${(i * 67) % 700}" r="${6 + (i % 21)}" fill="rgb(${(i * 17) % 255},${(i * 31) % 255},${(i * 11) % 255})"/>`);
  }
  return sharp(Buffer.from(`<svg width="700" height="700"><rect width="700" height="700" fill="#c8a978"/>${dots.join('')}</svg>`)).png().toBuffer();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('STANDALONE RESTORATION SCREEN');
  console.log('='.repeat(64));

  await page.request.post(`${API}/auth/register`,
    { data: { email: EMAIL, password: 'Password@123', fullName: 'Nguoi phuc hoi' } });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'Password@123');
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 });

  await page.request.post(`${API}/pets`, {
    data: { name: 'Be Mun', kind: 'CAT' },
    headers: { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem('pm-session') ?? '{}').accessToken ?? '')}` },
  }).catch(() => {});

  await page.goto(`${WEB}/restore`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(1200);
  ok('Duong dan /restore mo duoc', await page.locator('.drop').isVisible());
  ok('Khong con doi hoi chon goc chup', (await page.locator('text=Mặt trước').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'restore-1-empty.png'), fullPage: true });

  const file = path.join(OUT, 'anh-goc-tam.png');
  fs.writeFileSync(file, await makePhoto());
  await page.setInputFiles('#restore-file', file);

  await page.waitForSelector('.sheet', { timeout: 60000 });
  ok('Hop thoai so sanh tu mo ra', await page.locator('.sheet').isVisible());
  ok('Co thanh truot chia doi', await page.locator('#split-range').count() === 1);
  ok('Co ca anh truoc va anh sau', (await page.locator('.stage img').count()) === 2);

  const numbers = await page.locator('.tile dd').allInnerTexts();
  ok('Ba so do deu co gia tri that', numbers.length === 3 && numbers.every((t) => t.trim() && !t.includes('undefined')),
    numbers.join(' | '));

  const link = page.locator('a.plain');
  ok('Nut tai ve la mot lien ket that co thuoc tinh tai xuong',
    (await link.count()) === 1 && (await link.first().getAttribute('download') ?? '').endsWith('.png'),
    await link.first().getAttribute('download') ?? 'khong co');

  await page.screenshot({ path: path.join(OUT, 'restore-2-compare.png') });

  await page.locator('.modes button').nth(1).click();
  await page.waitForTimeout(400);
  ok('Doi sang kieu dat canh nhau', (await page.locator('.pair figure').count()) === 2);

  await page.locator('.modes button').first().click();
  await page.waitForTimeout(300);
  const before = await page.locator('.shot-after').evaluate((el) => getComputedStyle(el).clipPath);
  await page.locator('#split-range').fill('20');
  await page.waitForTimeout(300);
  const after = await page.locator('.shot-after').evaluate((el) => getComputedStyle(el).clipPath);
  ok('Keo thanh truot lam anh cat lai that su', before !== after, `${before} -> ${after}`);

  const pick = page.locator('#attach-pet');
  const petCount = await pick.locator('option').count();
  ok('Hop chon ho so co du lieu', petCount >= 1, `${petCount} lua chon`);

  await page.locator('.shut').click();
  await page.waitForTimeout(600);
  ok('Dong hop thoai duoc', (await page.locator('.sheet').count()) === 0);
  ok('Anh vua phuc hoi nam trong danh sach chua gan',
    (await page.locator('.kept-item').count()) >= 1);
  await page.screenshot({ path: path.join(OUT, 'restore-3-list.png'), fullPage: true });

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  fs.rmSync(file, { force: true });
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})();
