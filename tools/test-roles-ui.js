/**
 * Kiem thu ba nhom quyen tren trinh duyet.
 *
 * Trong tam la nguoi dung nhin thay gi: nhom Quan ly thay phan van hanh, nhom
 * Quan tri vien chi thay man quan ly tai khoan, va goi thang duong dan cua
 * nhom kia thi bi day ra.
 *
 * Chay: node tools/test-roles-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/** Cac o tren man hinh duoc chi den nhieu lan, gom lai mot cho. */
const BOX_EMAIL = '#account-email';
const BOX_ROLE = '#account-role';
const BTN_SAVE = '#account-save';
const GONE = 'detached';

/** Xuong dong, de gop mot doan chu nhieu dong thanh mot dong khi in ra. */
const NEWLINE = /\n/g;

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const PASSWORD = 'Petmory@2026';
const STAMP = Date.now();

let failed = 0;
let passed = 0;
function ok(name, good, note = '') {
  if (good) {
    passed += 1;
  } else {
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

async function signIn(page, email) {
  await page.goto(WEB, { waitUntil: 'load' });
  const account = page.locator('.account-button');
  await account.waitFor({ timeout: 15000 }).catch(() => undefined);
  if ((await account.count()) > 0) {
    await account.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 }).catch(() => undefined);
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASSWORD);
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 }).catch(async () => {
    await page.click('.submit');
    await page.waitForURL('**/home', { timeout: 40000 });
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('BA NHOM QUYEN TREN GIAO DIEN');
  console.log('='.repeat(64));

  // --- Nhom Quan ly ---
  console.log('');
  console.log('Nhom Quan ly');
  await signIn(page, 'quanly@petmory.local');
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForURL('**/admin/orders', { timeout: 30000 }).catch(() => undefined);
  ok('Mo khu noi bo thi vao thang ban dieu phoi don',
    page.url().includes('/admin/orders'), page.url().slice(-32));

  const railManager = await page.locator('.rail-link').allInnerTexts();
  ok('Thanh ben co day du phan van hanh', railManager.length >= 8, String(railManager.length));
  ok('Thanh ben khong co muc quan ly tai khoan',
    !railManager.some((one) => one.includes('Tài khoản')),
    railManager.join(' · ').slice(0, 70));

  await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  ok('Nhom Quan ly bi day ra khoi man quan ly tai khoan',
    !page.url().includes('/admin/accounts'), page.url().slice(-28));

  // --- Nhom Quan tri vien ---
  console.log('');
  console.log('Nhom Quan tri vien');
  await signIn(page, 'quantri@petmory.local');
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForURL('**/admin/accounts', { timeout: 30000 }).catch(() => undefined);
  ok('Mo khu noi bo thi vao thang man quan ly tai khoan',
    page.url().includes('/admin/accounts'), page.url().slice(-32));

  const railAdmin = await page.locator('.rail-link').allInnerTexts();
  ok('Thanh ben chi con mot muc', railAdmin.length === 1, railAdmin.join(' · '));

  for (const where of ['/admin/orders', '/admin/reports', '/admin/settings', '/admin/goods']) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    ok(`Nhom Quan tri vien bi day ra khoi ${where}`,
      !page.url().includes(where), page.url().slice(-26));
  }

  // --- Man quan ly tai khoan lam viec duoc ---
  console.log('');
  console.log('Man quan ly tai khoan');
  await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('#account-table', { timeout: 30000 });

  ok('Co ba o dem so tai khoan theo nhom',
    (await page.locator('.count-tile').count()) === 3,
    String(await page.locator('.count-tile').count()));
  ok('Bang liet ke duoc tai khoan',
    (await page.locator('#account-table tbody tr').count()) > 0,
    String(await page.locator('#account-table tbody tr').count()));

  /*
   * Tim dung dong cua chinh minh truoc khi kiem.
   *
   * Danh sach xep theo tai khoan moi nhat truoc, nen moi lan chay bai kiem lai
   * sinh them tai khoan la dong cua minh troi sang trang sau. Tim theo dia chi
   * thu thi bao nhieu tai khoan cung khong lam hong bai kiem.
   */
  await page.fill('#account-search', 'quantri@petmory.local');
  await page.locator('button:has-text("Tìm")').click();
  await page.waitForFunction(
    () => document.querySelectorAll('#account-table tbody tr').length === 1,
    undefined,
    { timeout: 20000 },
  );
  const selfRow = page.locator('#account-table tbody tr', { hasText: 'chính bạn' });
  ok('Dong cua chinh minh duoc danh dau', (await selfRow.count()) === 1,
    String(await selfRow.count()));
  // Nut sua cua dong minh bi khoa, nen khong tu doi quyen hay tu tat duoc.
  ok('Dong cua chinh minh khong sua duoc',
    await selfRow.locator('button:has-text("Sửa")').isDisabled());

  // Tao mot tai khoan moi.
  const email = `ui.vaitro.${STAMP}@petmory.local`;
  await page.fill('#account-search', '');
  await page.locator('button:has-text("Tìm")').click();
  await page.waitForTimeout(1200);
  await page.locator('#account-new').click();
  await page.waitForSelector(BOX_EMAIL, { timeout: 20000 });
  await page.fill(BOX_EMAIL, email);
  await page.fill('#account-name', 'Nguoi thu giao dien');
  await page.fill('#account-password', 'Password@123');
  await page.selectOption(BOX_ROLE, 'MANAGER');
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });

  await page.waitForFunction(
    (want) => document.querySelector('#account-table')?.textContent?.includes(want) ?? false,
    email,
    { timeout: 30000 },
  );
  ok('Tai khoan vua tao hien ra trong bang', true);

  /*
   * Sua tai khoan vua tao: doi nhom quyen va tat di, deu qua hop thoai.
   */
  const madeRow = page.locator('#account-table tbody tr', { hasText: email });
  await madeRow.locator('button:has-text("Sửa")').click();
  /*
   * Cho den khi o dia chi thu mang dung tai khoan dang sua. Chi cho o do hien
   * ra thi chua du: hop thoai them tai khoan cung co o do, va khi may ban thi
   * de doc trung hop thoai cu.
   */
  await page.waitForFunction(
    (want) => document.querySelector(want.box)?.value === want.email,
    { box: '.pm-dialog #account-email', email },
    { timeout: 20000 },
  );
  ok('Sua tai khoan thi dia chi thu bi khoa',
    await page.locator(`.pm-dialog ${BOX_EMAIL}`).isDisabled());
  ok('Sua tai khoan thi khong hoi mat khau',
    (await page.locator('#account-password').count()) === 0);
  await page.selectOption(BOX_ROLE, 'CUSTOMER');
  await page.locator('#account-active').uncheck();
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });

  await page.waitForFunction(
    (want) => {
      const rows = Array.from(document.querySelectorAll('#account-table tbody tr'));
      const mine = rows.find((row) => row.textContent?.includes(want));
      return mine !== undefined && mine.className.includes('off');
    },
    email,
    { timeout: 30000 },
  );
  ok('Sua xong thi dong hien la dang tat', true);
  ok('Sua xong thi nhom quyen doi theo',
    (await madeRow.innerText()).includes('Khách hàng'),
    (await madeRow.innerText()).replace(NEWLINE, ' ').slice(0, 70));

  await page.screenshot({ path: path.join(OUT, 'roles-1-accounts.png'), fullPage: true });

  // --- Khach thuong khong vao duoc cho nao trong khu noi bo ---
  console.log('');
  console.log('Khach hang');
  await signIn(page, 'khachhang@petmory.local');
  for (const where of ['/admin/accounts', '/admin/orders']) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    ok(`Khach bi day ra khoi ${where}`, !page.url().includes(where), page.url().slice(-24));
  }

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  await browser.close();
  console.log('');
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed} MUC HONG, ${passed} MUC PASS`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
