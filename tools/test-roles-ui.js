/**
 * Kiem thu ba nhom quyen tren trinh duyet.
 *
 * Trong tam la nguoi dung nhin thay gi: nhom Quan ly thay toan bo phan van
 * hanh cung voi quan ly tai khoan, kiem duyet cong dong va nhat ky thao tac.
 * Nhom Cham soc khach hang chi thay ban truc va goi thang duong dan khac thi
 * bi day ra. Khach khong vao duoc khu noi bo.
 *
 * Bai kiem chi doi nhom quyen cua tai khoan do chinh no tao ra.
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
  // Xoa phien dang mo ngay trong trinh duyet, khong phu thuoc nut dang xuat.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 }).catch(async () => {
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 40000 });
  });
}

/** Ten cac muc tren thanh ben, dung lai nhieu lan. */
const RAIL_ACCOUNTS = 'Tài khoản';
const RAIL_MODERATION = 'Kiểm duyệt cộng đồng';
const RAIL_AUDIT = 'Nhật ký thao tác';

/** Ban truc ma nhom Cham soc khach hang duoc vao. */
const DESK_SCREENS = ['/admin/orders', '/admin/customers', '/admin/chats', '/admin/payment-log'];

/** Cac man chi nhom Quan ly duoc vao. */
const MANAGER_SCREENS = [
  '/admin/goods', '/admin/assistant', '/admin/catalog', '/admin/reports',
  '/admin/settings', '/admin/moderation', '/admin/audit', '/admin/accounts',
];

async function openAdminHome(page) {
  await page.goto(`${WEB}/admin`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForURL('**/admin/orders', { timeout: 30000 }).catch(() => undefined);
}

async function checkManager(page) {
  console.log('');
  console.log('Nhom Quan ly');
  await signIn(page, 'quanly@petmory.local');
  await openAdminHome(page);
  ok('Mo khu noi bo thi vao thang ban dieu phoi don',
    page.url().includes('/admin/orders'), page.url().slice(-32));

  const rail = await page.locator('.rail-link').allInnerTexts();
  ok('Thanh ben co du muoi hai muc', rail.length === 12, String(rail.length));
  for (const label of [RAIL_ACCOUNTS, RAIL_MODERATION, RAIL_AUDIT]) {
    ok(`Thanh ben nhom Quan ly co muc ${label}`, rail.some((one) => one.includes(label)),
      rail.join(' · ').slice(0, 90));
  }

  for (const where of [...DESK_SCREENS, ...MANAGER_SCREENS]) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(`Nhom Quan ly mo duoc ${where}`, page.url().includes(where), page.url().slice(-26));
  }
}

async function findOwnRow(page) {
  /*
   * Tim dung dong cua chinh minh truoc khi kiem.
   *
   * Danh sach xep theo tai khoan moi nhat truoc, nen moi lan chay bai kiem lai
   * sinh them tai khoan la dong cua minh troi sang trang sau. Tim theo dia chi
   * thu thi bao nhieu tai khoan cung khong lam hong bai kiem.
   */
  await page.fill('#account-search', 'quanly@petmory.local');
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
}

async function createAccount(page, email) {
  await page.fill('#account-search', '');
  await page.locator('button:has-text("Tìm")').click();
  await page.waitForTimeout(1200);
  await page.locator('#account-new').click();
  await page.waitForSelector(BOX_EMAIL, { timeout: 20000 });

  const choices = await page.locator(`${BOX_ROLE} option`).evaluateAll(
    (all) => all.map((one) => one.value).sort((a, b) => a.localeCompare(b)),
  );
  ok('O chon nhom chi con ba nhom, khong con Quan tri vien',
    JSON.stringify(choices) === JSON.stringify(['CUSTOMER', 'MANAGER', 'SUPPORT']), choices.join(','));

  await page.fill(BOX_EMAIL, email);
  await page.fill('#account-name', 'Nguoi thu giao dien');
  await page.fill('#account-password', 'Password@123');
  await page.selectOption(BOX_ROLE, 'SUPPORT');
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });

  await page.waitForFunction(
    (want) => document.querySelector('#account-table')?.textContent?.includes(want) ?? false,
    email,
    { timeout: 30000 },
  );
  const madeRow = page.locator('#account-table tbody tr', { hasText: email });
  ok('Tai khoan vua tao hien ra trong bang voi nhom CSKH',
    (await madeRow.innerText()).includes('Chăm sóc khách hàng'),
    (await madeRow.innerText()).replace(NEWLINE, ' ').slice(0, 70));
  return madeRow;
}

async function editAccount(page, email, madeRow) {
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
}

async function checkAccountsScreen(page) {
  console.log('');
  console.log('Man quan ly tai khoan cua nhom Quan ly');
  await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('#account-table', { timeout: 30000 });

  ok('Co ba o dem so tai khoan theo nhom',
    (await page.locator('.count-tile').count()) === 3,
    String(await page.locator('.count-tile').count()));
  ok('Bang liet ke duoc tai khoan',
    (await page.locator('#account-table tbody tr').count()) > 0,
    String(await page.locator('#account-table tbody tr').count()));

  await findOwnRow(page);
  const email = `ui.vaitro.${STAMP}@petmory.local`;
  const madeRow = await createAccount(page, email);
  await editAccount(page, email, madeRow);
  await page.screenshot({ path: path.join(OUT, 'roles-1-accounts.png'), fullPage: true });
}

async function checkSupport(page) {
  console.log('');
  console.log('Nhom Cham soc khach hang');
  await signIn(page, 'cskh@petmory.local');
  await openAdminHome(page);
  ok('Mo khu noi bo thi vao thang ban dieu phoi don',
    page.url().includes('/admin/orders'), page.url().slice(-32));
  await page.waitForSelector('.rail-link', { timeout: 20000 });

  const rail = await page.locator('.rail-link').allInnerTexts();
  ok('Thanh ben chi co bon muc cua ban truc', rail.length === 4, rail.join(' · '));
  ok('Thanh ben khong co tai khoan, kiem duyet hay nhat ky thao tac',
    !rail.some((one) => [RAIL_ACCOUNTS, RAIL_MODERATION, RAIL_AUDIT].some((label) => one.includes(label))),
    rail.join(' · '));

  for (const where of DESK_SCREENS) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(`Nhom CSKH mo duoc ${where}`, page.url().includes(where), page.url().slice(-26));
  }
  for (const where of MANAGER_SCREENS) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    ok(`Nhom CSKH bi day ra khoi ${where}`, !page.url().includes(where), page.url().slice(-26));
  }
}

async function checkCustomer(page) {
  console.log('');
  console.log('Khach hang');
  await signIn(page, 'khachhang@petmory.local');
  for (const where of ['/admin/accounts', '/admin/orders', '/admin/moderation']) {
    await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
    await page.waitForTimeout(1800);
    ok(`Khach bi day ra khoi ${where}`, !page.url().includes(where), page.url().slice(-24));
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('BA NHOM QUYEN TREN GIAO DIEN');
  console.log('='.repeat(64));

  await checkManager(page);
  await checkAccountsScreen(page);
  await checkSupport(page);
  await checkCustomer(page);

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
