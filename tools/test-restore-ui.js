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
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
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
  await page.click('button[type=submit]');
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

  await page.waitForSelector('.preview img', { timeout: 15000 });
  ok('Anh vua chon hien xem truoc', await page.locator('.preview img').isVisible());
  await page.locator('.preview-drop').click();
  await page.waitForSelector('label.drop', { timeout: 5000 });
  ok('Bo anh chon nham thi quay ve buoc dau', await page.locator('label.drop').isVisible());

  await page.setInputFiles('#restore-file', file);
  await page.waitForSelector('#restore-run', { timeout: 15000 });
  await page.click('#restore-run');
  await page.waitForSelector('.stage .shot-after', { timeout: 60000 });
  await page.waitForTimeout(600);
  ok('Co thanh truot chia doi', await page.locator('#split-range').count() === 1);
  ok('Co ca anh truoc va anh sau', (await page.locator('.stage img').count()) === 2);

  const numbers = await page.locator('.facts dd').allInnerTexts();
  ok('Ba so do deu co gia tri that', numbers.length === 3 && numbers.every((t) => t.trim() && !t.includes('undefined')),
    numbers.join(' | '));

  const link = page.locator('#restore-download');
  ok('Nut tai ve la mot lien ket that co thuoc tinh tai xuong',
    (await link.count()) === 1 && (await link.getAttribute('download') ?? '').endsWith('.png'),
    await link.getAttribute('download') ?? 'khong co');
  const [saved] = await Promise.all([page.waitForEvent('download'), link.click()]);
  ok('Tai ve duoc ban phuc hoi', saved.suggestedFilename().endsWith('-phuc-hoi.png'), saved.suggestedFilename());

  await page.screenshot({ path: path.join(OUT, 'restore-2-compare.png') });

  const before = await page.locator('.shot-after').evaluate((el) => getComputedStyle(el).clipPath);
  await page.locator('#split-range').fill('20');
  await page.waitForTimeout(300);
  const after = await page.locator('.shot-after').evaluate((el) => getComputedStyle(el).clipPath);
  ok('Keo thanh truot lam anh cat lai that su', before !== after, `${before} -> ${after}`);

  await page.locator('.actions button').click();
  await page.waitForSelector('label.drop', { timeout: 5000 });
  ok('Phuc hoi anh khac thi quay ve buoc dau', await page.locator('label.drop').isVisible());

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  fs.rmSync(file, { force: true });
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})();
