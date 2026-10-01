/**
 * Kiem thu cat va xoay anh truoc khi gui (Phu luc 01 muc 3).
 *
 * Bai kiem thu khong tin vao anh xem truoc tren man hinh. No doc lai kich
 * thuoc that cua anh da nam tren may chu, vi do moi la thu quyet dinh xuong
 * co du diem anh de lam hay khong.
 *
 * Chay: node tools/test-photo-edit.js
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
const EMAIL = `cataanh.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';

/** Anh goc: rong hon cao, de xoay mot phan tu la thay ngay dai rong doi cho. */
const WIDE = 1600;
const TALL = 1200;

const KEEP_ORIGINAL = 'Giữ ảnh gốc';

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 60 giay');
}

/**
 * Mot buc anh co van, khong phai mot mang mau phang.
 *
 * Mang mau phang bi cham la mo tit va co the bi xep loai khong dung duoc,
 * lam lech phan kiem tra. Van o day du de anh duoc cham la ro net.
 */
async function makePhoto(where) {
  const dots = Buffer.alloc(WIDE * TALL * 3);
  for (let y = 0; y < TALL; y += 1) {
    for (let x = 0; x < WIDE; x += 1) {
      const at = (y * WIDE + x) * 3;
      const checker = ((x >> 2) + (y >> 2)) % 2 === 0;
      dots[at] = checker ? 225 : 90;
      dots[at + 1] = checker ? 190 : 70;
      dots[at + 2] = checker ? 150 : 55;
    }
  }
  const bytes = await sharp(dots, { raw: { width: WIDE, height: TALL, channels: 3 } })
    .png()
    .toBuffer();
  fs.writeFileSync(where, bytes);
  return where;
}

/**
 * Doi cho den khi may chu that su nhan duoc anh.
 *
 * Doi mot khoang co dinh thi khi may cham se bao hong oan, nen o day hoi
 * lai cho den khi thay anh, va chi chiu thua sau hai muoi giay.
 */
async function waitForPhoto(page, token, petId) {
  for (let i = 0; i < 40; i += 1) {
    const found = await newestSize(page, token, petId);
    if (found) {
      return found;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

/** Kich thuoc ma may chu ghi nhan cho buc anh moi nhat cua mot be. */
async function newestSize(page, token, petId) {
  const answer = await page.request.get(`${API}/pet-photos?pet=${petId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = await answer.json();
  const plain = rows.filter((one) => !one.isRestored);
  const last = plain[plain.length - 1];
  return last ? { width: last.quality.width, height: last.quality.height } : null;
}

/** Xoa het anh cua be, de moi phan kiem tra bat dau tu album rong. */
async function clearAlbum(page, token, petId) {
  const answer = await page.request.get(`${API}/pet-photos?pet=${petId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  for (const one of await answer.json()) {
    await page.request.delete(`${API}/pet-photos/${one._id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('CAT VA XOAY ANH TRUOC KHI GUI');
  console.log('='.repeat(64));

  const signUp = await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Chu anh cat' },
  });
  const token = (await signUp.json()).accessToken;
  const pet = await (
    await page.request.post(`${API}/pets`, {
      data: { name: `Be Cat ${STAMP}`, kind: 'DOG' },
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/home', { timeout: 30000 });

  const album = `${WEB}/pets/${pet._id}/journal?view=photos`;
  const file = await makePhoto(path.join(OUT, `crop-source-${STAMP}.png`));

  // --- Hop sua anh mo ra truoc khi anh roi may ---
  await page.goto(album, { waitUntil: 'networkidle' });
  await settle(page);
  await page.setInputFiles('#album-file', [file]);
  await page.waitForSelector('.edit', { timeout: 20000 });
  ok('Chon anh xong thi hop sua anh mo ra', (await page.locator('.edit').count()) === 1);
  ok('Co ca nut xoay trai va xoay phai',
    (await page.locator('.tools button:has-text("Xoay")').count()) === 2);
  ok('Co ba kieu khung cat', (await page.locator('.chip').count()) === 3);
  await page.waitForSelector('.frame img', { timeout: 20000 });
  await page.screenshot({ path: path.join(OUT, 'crop-1-open.png') });

  // --- NT-03.1 Xoay bon lan thi ve dung huong cu ---
  const sizeLine = page.locator('.size');
  const before = (await sizeLine.innerText()).trim();
  for (let i = 0; i < 4; i += 1) {
    await page.locator('button:has-text("Xoay phải")').click();
    await page.waitForTimeout(350);
  }
  ok('Xoay bon lan thi kich thuoc tro lai nhu cu',
    (await sizeLine.innerText()).trim() === before, `${before} -> ${(await sizeLine.innerText()).trim()}`);

  await page.locator(`.edit-foot button:has-text("${KEEP_ORIGINAL}")`).click();
  const asSent = await waitForPhoto(page, token, pet._id);
  ok('Anh gui len dung bang anh goc',
    asSent !== null && asSent.width === WIDE && asSent.height === TALL,
    asSent ? `${asSent.width}x${asSent.height}` : 'khong thay anh');

  // --- Xoay mot phan tu thi dai rong doi cho ---
  await clearAlbum(page, token, pet._id);
  await page.goto(album, { waitUntil: 'networkidle' });
  await settle(page);
  await page.setInputFiles('#album-file', [file]);
  await page.waitForSelector('.frame img', { timeout: 20000 });
  await page.locator('button:has-text("Xoay phải")').click();
  await page.waitForTimeout(500);
  await page.locator('.edit-foot button:has-text("gửi")').click();
  const turned = await waitForPhoto(page, token, pet._id);
  ok('Xoay mot phan tu thi be rong va be cao doi cho',
    turned !== null && turned.width === TALL && turned.height === WIDE,
    turned ? `${turned.width}x${turned.height}` : 'khong thay anh');

  // --- NT-03.2 Cat con mot phan tu ---
  await clearAlbum(page, token, pet._id);
  await page.goto(album, { waitUntil: 'networkidle' });
  await settle(page);
  await page.setInputFiles('#album-file', [file]);
  await page.waitForSelector('.frame img', { timeout: 20000 });
  await page.locator('#keep-width').fill('50');
  await page.locator('#keep-height').fill('50');
  await page.waitForTimeout(400);
  ok('Man hinh bao truoc so diem anh con lai',
    (await sizeLine.innerText()).includes('800') && (await sizeLine.innerText()).includes('600'),
    (await sizeLine.innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'crop-2-quarter.png') });
  await page.locator('.edit-foot button:has-text("gửi")').click();
  const quarter = await waitForPhoto(page, token, pet._id);
  ok('Cat con mot phan tu thi anh tren may chu dung bang phan da cat',
    quarter !== null && quarter.width === 800 && quarter.height === 600,
    quarter ? `${quarter.width}x${quarter.height}` : 'khong thay anh');

  // --- NT-03.3 Canh bao khi cat qua sau ---
  await clearAlbum(page, token, pet._id);
  await page.goto(album, { waitUntil: 'networkidle' });
  await settle(page);
  await page.setInputFiles('#album-file', [file]);
  await page.waitForSelector('.frame img', { timeout: 20000 });
  ok('Chua cat thi khong co canh bao',
    (await page.locator('.size.warn').count()) === 0);
  await page.locator('#keep-height').fill('40');
  await page.waitForTimeout(400);
  const warning = page.locator('.size.warn');
  ok('Cat xuong duoi nguong thi canh bao hien ngay', (await warning.count()) === 1,
    (await sizeLine.innerText()).trim());
  ok('Canh bao noi ro nguong la bao nhieu',
    (await sizeLine.innerText()).includes('1024'), (await sizeLine.innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'crop-3-warning.png') });

  // --- Khung vuong keo be cao theo be rong ---
  await page.locator('.chip:has-text("Vuông")').click();
  await page.waitForTimeout(400);
  const square = (await sizeLine.innerText()).match(/(\d+)\s*×\s*(\d+)/);
  ok('Khung vuong cho ra anh vuong',
    square !== null && Math.abs(Number(square[1]) - Number(square[2])) <= 2,
    square ? `${square[1]}x${square[2]}` : (await sizeLine.innerText()).trim());
  ok('Chon khung co ti le thi thanh be cao bi khoa',
    await page.locator('#keep-height').isDisabled());

  await page.locator('.edit-foot button:has-text("Hủy")').click();
  await page.waitForTimeout(1500);
  ok('Bam huy thi khong anh nao duoc gui',
    (await newestSize(page, token, pet._id)) === null);

  // --- NT-03.4 Anh da nam trong album thi khong sua duoc nua ---
  await page.setInputFiles('#album-file', [file]);
  await page.waitForSelector('.frame img', { timeout: 20000 });
  await page.locator(`.edit-foot button:has-text("${KEEP_ORIGINAL}")`).click();
  await waitForPhoto(page, token, pet._id);
  await settle(page);
  await page.waitForTimeout(1200);
  ok('Anh da len album thi khong con nut xoay',
    (await page.locator('.shot button:has-text("Xoay")').count()) === 0);
  ok('Anh da len album thi khong con nut cat',
    (await page.locator('.shot button:has-text("Cắt")').count()) === 0);
  ok('Hop sua anh khong con mo', (await page.locator('.edit').count()) === 0);

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  fs.rmSync(file, { force: true });
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
