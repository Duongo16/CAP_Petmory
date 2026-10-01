/**
 * Browser test of the photo album of one pet.
 *
 * This screen used to lay out six fixed slots and ask the customer to fill each
 * named angle. It is an album now: any number of photographs, in any pose. The
 * old version of this file tested the grid, so it was rewritten rather than
 * repaired.
 *
 * Run: node tools/test-photos-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `anhbe.${STAMP}@petmory.local`;

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

/**
 * Waits for the development server to finish compiling.
 *
 * While it is rebuilding, an error overlay covers the page and swallows every
 * click, so a test would fail for a reason unrelated to what it is checking.
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

async function makePhoto(tint, where) {
  const bytes = await sharp({
    create: { width: 700, height: 700, channels: 3, background: tint },
  })
    .png()
    .toBuffer();
  fs.writeFileSync(where, bytes);
  return where;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('PET PHOTO ALBUM');
  console.log('='.repeat(64));

  const signUp = await page.request.post(`${API}/auth/register`,
    { data: { email: EMAIL, password: 'Password@123', fullName: 'Chu album' } });
  const token = (await signUp.json()).accessToken;
  const pet = await (await page.request.post(`${API}/pets`, {
    data: { name: `Be Bong ${STAMP}`, kind: 'DOG' },
    headers: { Authorization: `Bearer ${token}` },
  })).json();

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'Password@123');
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 });

  await page.goto(`${WEB}/pets/${pet._id}/photos`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(1200);

  ok('Trang album mo duoc', (await page.locator('.album').count()) === 1);
  ok('Khong con luoi sau goc chup', (await page.locator('.slot, .angle-tile').count()) === 0);
  ok('Ten be hien o tieu de',
    (await page.locator('h1').innerText()).includes('Be Bong'),
    await page.locator('h1').innerText());
  ok('Bat dau la rong', (await page.locator('.empty').count()) === 1);
  await page.screenshot({ path: path.join(OUT, 'album-1-empty.png'), fullPage: true });

  // --- Several at once ---
  const files = [
    await makePhoto({ r: 210, g: 160, b: 120 }, path.join(OUT, 'album-a.png')),
    await makePhoto({ r: 130, g: 170, b: 210 }, path.join(OUT, 'album-b.png')),
    await makePhoto({ r: 160, g: 200, b: 150 }, path.join(OUT, 'album-c.png')),
  ];
  await page.setInputFiles('#album-file', files);
  /*
   * Moi buc di qua hop sua anh truoc khi len may chu. O day khong xoay khong
   * cat, chi bam giu nguyen tung buc, vi phan xoay va cat co bai kiem thu
   * rieng.
   */
  await page.waitForSelector('.edit', { timeout: 20000 });
  for (let i = 0; i < files.length; i += 1) {
    await page.locator('.edit-foot button:has-text("Giữ ảnh gốc")').click();
    await page.waitForTimeout(400);
  }
  /*
   * Doi den khi ca ba anh ve xong ra man hinh, thay vi doi mot khoang co
   * dinh. Khoang co dinh du dai luc may ranh, nhung khi may ban thi bai kiem
   * thu doc phai man hinh chua ve xong va bao hong oan.
   */
  await page.locator('.shot-photo img').nth(2).waitFor({ timeout: 40000 });

  const shots = page.locator('.shot');
  ok('Gui ba anh mot lan deu len het', (await shots.count()) === 3,
    `${await shots.count()} anh`);
  ok('Bo dem hien dung so', (await page.locator('.tally').innerText()).startsWith('3/'),
    await page.locator('.tally').innerText());
  ok('Moi anh deu ve duoc ra man hinh',
    (await page.locator('.shot-photo img').count()) === 3);
  await page.screenshot({ path: path.join(OUT, 'album-2-full.png'), fullPage: true });

  // --- Removing one ---
  await page.locator('.shot-drop').first().click();
  await page.waitForTimeout(3000);
  ok('Xoa mot anh thi con hai', (await shots.count()) === 2, `${await shots.count()} anh`);

  // --- The pointer to the restoration screen ---
  const hint = page.locator('.hint a');
  ok('Co loi nhac sang man phuc hoi rieng',
    (await hint.count()) === 1 && (await hint.getAttribute('href')) === '/restore',
    (await hint.getAttribute('href')) ?? 'khong co');

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  for (const one of files) {
    fs.rmSync(one, { force: true });
  }
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})();
