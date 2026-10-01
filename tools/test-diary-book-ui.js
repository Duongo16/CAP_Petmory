/**
 * Kiem thu quyen so ky niem: lat trang, viet chu, dan anh, dat hinh trang tri.
 *
 * Bai kiem thu khong tin vao man hinh: sau moi lan luu, no doc lai ban ghi
 * tren may chu, va mo lai trang bang mot trinh duyet chua dang nhap de xem
 * nguoi ngoai co thay dung nhu vay khong.
 *
 * Chay: node tools/test-diary-book-ui.js
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
const EMAIL = `so.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';

/** Loi viet len trang, dung de tim lai trang do o moi cho khac. */
const WORDS = 'Nho mai buoi chieu hom ay';

let failed = 0;
function ok(name, good, note = '') {
  if (!good) {
    failed += 1;
  }
  console.log(`  ${good ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
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

/** Gui mot buc anh vao album cua mot be. */
async function sendPhoto(token, petId, tint) {
  const bytes = await sharp({ create: { width: 900, height: 700, channels: 3, background: tint } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'anh.png');
  const answer = await fetch(`${API}/pet-photos/${petId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return (await answer.json())._id;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('QUYEN SO KY NIEM: LAT TRANG VA BAY TRI');
  console.log('='.repeat(66));

  const signUp = await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Chu quyen so' },
  });
  const token = (await signUp.json()).accessToken;
  const pet = await (
    await page.request.post(`${API}/pets`, {
      data: { name: `Be So ${STAMP}`, kind: 'CAT', tagline: 'Be thich nam cua so' },
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();

  await sendPhoto(token, pet._id, { r: 225, g: 170, b: 130 });
  await sendPhoto(token, pet._id, { r: 140, g: 185, b: 215 });
  for (let i = 0; i < 3; i += 1) {
    await page.request.post(`${API}/memories`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        pet: pet._id,
        title: `Ngay thu ${i + 1}`,
        body: 'Be cua toi hom nay rat vui ve, chay quanh nha ca buoi.',
        happenedAt: new Date(2024, i, 10).toISOString(),
        place: 'Ha Noi',
        topic: 'EVERYDAY',
      },
    });
  }

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 });

  // --- Quyen so mo ra o trang bia ---
  await page.goto(`${WEB}/pets/${pet._id}/journal`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('.book .leaf', { timeout: 30000 });
  ok('Quyen so co du so to giay', (await page.locator('.book .leaf').count()) === 3,
    `${await page.locator('.book .leaf').count()} to`);
  ok('Mo ra la thay bia',
    (await page.locator('.leaf').first().locator('.front .cover h2').innerText()).includes(String(STAMP)),
    (await page.locator('.leaf').first().locator('.front .cover h2').innerText()).trim());
  ok('Chua lat thi khong lui lai duoc', await page.locator('.turn').first().isDisabled());
  await page.screenshot({ path: path.join(OUT, 'book-1-closed.png') });

  // --- Lat trang ---
  await page.locator('.turn').nth(1).click();
  await page.waitForTimeout(1200);
  ok('Lat mot to thi bo dem nhay len',
    (await page.locator('.where').innerText()).includes('1/3'),
    (await page.locator('.where').innerText()).trim());
  ok('To da lat nam ben trai', (await page.locator('.leaf.turned').count()) === 1);
  ok('Trang dau la khoanh khac cu nhat',
    (await page.locator('.leaf.turned .back .plain-title').innerText()).includes('Ngay thu 1'),
    (await page.locator('.leaf.turned .back .plain-title').innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'book-2-open.png') });

  // --- Bay tri trang ben phai ---
  await page.locator('button:has-text("Trang trí trang bên phải")').click();
  await page.waitForSelector('.editor .surface', { timeout: 20000 });
  ok('Hop bay tri co du ba khay do', (await page.locator('.tool-tabs button').count()) === 3);
  ok('Co du sau kieu giay', (await page.locator('.paper-chip').count()) === 6);

  await page.locator('.tool-tabs button:has-text("Hình dán")').click();
  await page.locator('.sticker-tray button').first().waitFor({ timeout: 30000 });
  ok('Bo hinh dan co du muoi hai hinh',
    (await page.locator('.sticker-tray button').count()) === 12,
    String(await page.locator('.sticker-tray button').count()));
  await page.locator('.sticker-tray button').nth(1).click();

  await page.locator('.tool-tabs button:has-text("Ảnh")').click();
  /*
   * Album duoc tai ve dang tung tep anh mot, nen khi may ban thi khay anh
   * hien ra cham hon. Doi lau hon o day thay vi bao hong ngay.
   */
  await page.locator('.shot-tray button').first().waitFor({ timeout: 40000 });
  ok('Khay anh lay dung album cua be',
    (await page.locator('.shot-tray button').count()) === 2,
    String(await page.locator('.shot-tray button').count()));
  await page.locator('.shot-tray button').first().click();

  await page.locator('.tool-tabs button:has-text("Chữ")').click();
  await page.locator('button:has-text("Thêm một ô chữ")').click();
  await page.locator('.knob textarea').fill(WORDS);
  await page.locator('.paper-chip:has-text("Chấm bi")').click();
  await page.waitForTimeout(400);
  ok('Trang co du ba mon', (await page.locator('.surface .item').count()) === 3,
    String(await page.locator('.surface .item').count()));

  // --- Keo mot mon sang cho khac ---
  const item = page.locator('.surface .item').last();
  const before = await item.evaluate((el) => `${el.style.left} ${el.style.top}`);
  const box = await item.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 110, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await item.evaluate((el) => `${el.style.left} ${el.style.top}`);
  ok('Keo duoc mot mon sang cho khac', before !== after, `${before} -> ${after}`);

  // --- Di chuyen bang ban phim ---
  const beforeKeys = await item.evaluate((el) => el.style.left);
  await item.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const afterKeys = await item.evaluate((el) => el.style.left);
  ok('Di chuyen duoc bang phim mui ten', beforeKeys !== afterKeys,
    `${beforeKeys} -> ${afterKeys}`);
  await page.screenshot({ path: path.join(OUT, 'book-3-editor.png') });

  await page.locator('button:has-text("Lưu trang")').click();
  await page.waitForTimeout(2500);
  ok('Trang bay tri hien ngay tren quyen so',
    (await page.locator('.leaf .item').count()) >= 3,
    String(await page.locator('.leaf .item').count()));
  await page.screenshot({ path: path.join(OUT, 'book-4-decorated.png') });

  // --- May chu ghi lai dung ---
  const saved = await page.request.get(`${API}/memories/pet/${pet._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = (await saved.json()).rows;
  const decorated = rows.find((one) => (one.decor ?? []).length > 0);
  ok('May chu ghi dung so mon tren trang', (decorated?.decor?.length ?? 0) === 3,
    String(decorated?.decor?.length));
  ok('May chu ghi dung kieu giay', decorated?.paper === 'DOT', String(decorated?.paper));
  ok('Sua trang khong lam mat tieu de', Boolean(decorated?.title), String(decorated?.title));
  ok('May chu ghi ca chu, anh va hinh dan',
    new Set((decorated?.decor ?? []).map((one) => one.kind)).size === 3,
    (decorated?.decor ?? []).map((one) => one.kind).join(','));

  // --- Mo lai van con nguyen ---
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('.book .leaf', { timeout: 30000 });
  await page.locator('.turn').nth(1).click();
  await page.waitForTimeout(1200);
  ok('Mo lai quyen so van thay trang da bay tri',
    (await page.locator('.leaf .item').count()) >= 3,
    String(await page.locator('.leaf .item').count()));

  // --- Nguoi ngoai doc thay dung quyen so do ---
  await page.locator('button:has-text("Liên kết chia sẻ")').click();
  await page.waitForSelector('.sheet .make', { timeout: 20000 });
  await page.locator('.mode input').check();
  await page.waitForTimeout(1600);
  await page.locator('.sheet .shut').click();
  const guest = await browser.newContext({ viewport: { width: 1360, height: 1020 } });
  const eye = await guest.newPage();
  const guestBroken = [];
  eye.on('pageerror', (e) => guestBroken.push(String(e)));
  await eye.goto(`${WEB}/diaries/${pet._id}`, { waitUntil: 'networkidle' });
  await settle(eye);
  await eye.waitForSelector('.book .leaf', { timeout: 30000 });
  ok('Nguoi chua dang nhap cung thay quyen so',
    (await eye.locator('.book .leaf').count()) === 3);
  await eye.locator('.turn').nth(1).click();
  await eye.waitForTimeout(1200);
  ok('Nguoi ngoai thay dung trang da bay tri',
    (await eye.locator('.leaf .item').count()) >= 3,
    String(await eye.locator('.leaf .item').count()));
  ok('Nguoi ngoai khong co nut bay tri',
    (await eye.locator('.decorate-button').count()) === 0);
  /*
   * Anh dan len trang phai hien voi nguoi ngoai. Anh do duoc trang dung den
   * qua lop bay tri chu khong qua danh sach anh cua khoanh khac, nen day la
   * duong rieng va phai duoc kiem rieng.
   */
  const pinned = eye.locator('.leaf .item img');
  await pinned.first().waitFor({ timeout: 15000 });
  ok('Anh dan tren trang hien duoc voi nguoi ngoai',
    (await pinned.first().evaluate((el) => el.naturalWidth)) > 0,
    String(await pinned.first().evaluate((el) => el.naturalWidth)));
  await eye.screenshot({ path: path.join(OUT, 'book-5-public.png') });

  // --- Tren dien thoai chi mo mot trang mot luc ---
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const small = await phone.newPage();
  const phoneBroken = [];
  small.on('pageerror', (e) => phoneBroken.push(String(e)));
  await small.goto(`${WEB}/diaries/${pet._id}`, { waitUntil: 'networkidle' });
  await settle(small);
  await small.waitForSelector('.book .leaf', { timeout: 30000 });
  ok('Dien thoai chi mo mot trang mot luc',
    (await small.locator('.book .leaf').count()) === 1,
    String(await small.locator('.book .leaf').count()));
  ok('Bo dem tren dien thoai dem theo trang',
    (await small.locator('.where').innerText()).includes('Trang 1/5'),
    (await small.locator('.where').innerText()).trim());

  await small.locator('.turn').nth(1).click();
  await small.waitForTimeout(900);
  await small.locator('.turn').nth(1).click();
  await small.waitForTimeout(900);
  ok('Lat hai lan tren dien thoai la den trang da bay tri',
    (await small.locator('.leaf .item').count()) >= 3,
    String(await small.locator('.leaf .item').count()));
  ok('Trang khong bi tran ngang tren dien thoai',
    (await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)));
  await small.screenshot({ path: path.join(OUT, 'book-6-phone.png'), fullPage: true });
  ok('Khong co loi nao tren dien thoai', phoneBroken.length === 0,
    phoneBroken.slice(0, 2).join(' | '));
  await phone.close();

  ok('Khong co loi nao trong trang cua chu', broken.length === 0, broken.slice(0, 2).join(' | '));
  ok('Khong co loi nao trong trang cua khach', guestBroken.length === 0,
    guestBroken.slice(0, 2).join(' | '));

  await browser.close();
  console.log('-'.repeat(66));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
