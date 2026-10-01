/**
 * Kiem thu tren trinh duyet luong mua hang co san, theo Phu luc 01 muc 23.
 *
 * Di het duong khach di: xem ke hang, loc, mo mot mon, chon to hop, bo vao
 * gio chung voi mot mon hang tuy bien, dat don, roi mo trang quan tri de sua
 * ton kho va doc lich su. Moi con so deu doc lai tu may chu sau do.
 *
 * Chay: node tools/test-goods-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/** Cac o tren man hinh duoc chi den nhieu lan, gom lai mot cho. */
const BOX_CODE = '#goods-code';
const BOX_IMAGE = '#goods-image';
const BTN_IMAGE = '.pm-dialog pm-image-link .link-add';
const LINK_ONE = 'https://placehold.co/600x400.png';
const LINK_TWO = 'https://placehold.co/300x200.png';
const BOX_NAME = '#goods-name';
const BOX_VARIANT = '.variant-row input';
const BTN_SAVE = '#goods-save';
const BTN_EDIT_ON = (code) => `#goods-table tbody tr:has-text("${code}") button:has-text("Sửa")`;
const STATUS_GOOD = '.pm-status[data-tone="good"]';

const ROW_GOODS = '#goods-table tbody tr';
const CARD_GRID = '.grid .card';
const GONE = 'detached';
const SHEET = '.pm-dialog';

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `kh.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';
const BOSS_PASSWORD = 'Petmory@2026';

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

/** Dang nhap qua chinh man hinh, sau khi da thoat tai khoan dang mo. */
async function signIn(page, email, password) {
  await page.goto(WEB, { waitUntil: 'networkidle' });
  const account = page.locator('.account-button');
  if ((await account.count()) > 0) {
    await account.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 });
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 });
}

/**
 * Xoa cac mon do chinh bai kiem nay tao ra o nhung luot chay truoc.
 *
 * Bai kiem tu xoa mon no vua tao o buoc cuoi, nhung mot luot hong giua chung
 * se de lai mon do, va luot sau se dem thua mon khi kiem ke hang. Don tu dau
 * thi chay lai bao nhieu lan cung ra mot ket qua.
 */
async function sweepLeftovers() {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'quanly@petmory.local', password: BOSS_PASSWORD }),
  });
  const token = (await login.json()).accessToken;
  const head = { authorization: `Bearer ${token}` };
  const listed = await (await fetch(`${API}/admin/goods?page=1`, { headers: head })).json();
  for (const one of listed.rows ?? []) {
    if (one.code.startsWith('G-THU-')) {
      await fetch(`${API}/admin/goods/${one.code}`, { method: 'DELETE', headers: head });
    }
  }
}

(async () => {
  await sweepLeftovers();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 1020 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('MUA HANG CO SAN');
  console.log('='.repeat(64));

  await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Khach mua hang co san' },
  });
  await signIn(page, EMAIL, PASSWORD);

  // --- Ke hang ---
  await page.locator('.nav a:has-text("Hàng có sẵn")').click();
  await page.waitForURL('**/goods', { timeout: 20000 });
  await settle(page);
  await page.waitForSelector(CARD_GRID, { timeout: 30000 });
  const all = await page.locator(CARD_GRID).count();
  ok('Ke hang co du sau mon', all === 6, String(all));
  ok('Moi the deu co gia tu bao nhieu',
    (await page.locator('.card-price').count()) === all);
  ok('Co du bon nhom hang cong voi muc tat ca',
    (await page.locator('.groups .chip').count()) === 5,
    String(await page.locator('.groups .chip').count()));
  await page.screenshot({ path: path.join(OUT, 'goods-1-list.png'), fullPage: true });

  // --- Loc theo nhom ---
  await page.locator('.groups .chip:has-text("Đồ dùng hằng ngày")').click();
  await page.waitForTimeout(1200);
  const inGroup = await page.locator(CARD_GRID).count();
  ok('Loc theo nhom thi chi con hang cua nhom do', inGroup > 0 && inGroup < all,
    `${all} -> ${inGroup}`);

  // --- Tim kiem ---
  await page.locator('.groups .chip:has-text("Tất cả")').click();
  await page.waitForTimeout(900);
  await page.fill('#goods-search', 'vòng');
  await page.locator('.find button').click();
  await page.waitForTimeout(1200);
  ok('Tim theo ten ra dung mon', (await page.locator(CARD_GRID).count()) === 1,
    String(await page.locator(CARD_GRID).count()));

  // --- Mot mon co to hop het hang ---
  await page.locator(CARD_GRID).first().click();
  await page.waitForURL('**/goods/**', { timeout: 20000 });
  await settle(page);
  await page.waitForSelector('.variant', { timeout: 20000 });
  ok('Mon nay co bon to hop', (await page.locator('.variant').count()) === 4,
    String(await page.locator('.variant').count()));
  ok('To hop het hang duoc danh dau', (await page.locator('.variant.gone').count()) === 1,
    String(await page.locator('.variant.gone').count()));
  ok('To hop het hang khong bam vao duoc',
    await page.locator('.variant.gone').first().isDisabled());
  ok('Man hinh noi ro con bao nhieu mon trong kho',
    (await page.locator('.left').innerText()).includes('Còn'),
    (await page.locator('.left').innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'goods-2-detail.png'), fullPage: true });

  // --- Bo vao gio ---
  await page.locator('.variant').first().click();
  await page.locator('.row .pm-button-primary').click();
  await page.locator('.cart-button .badge').waitFor({ timeout: 20000 });
  ok('Bo vao gio thi bo dem tren thanh dieu huong tang',
    (await page.locator('.cart-button .badge').innerText()).trim() === '1',
    (await page.locator('.cart-button .badge').innerText()).trim());

  // --- Gio chua duoc ca hai dong hang ---
  /*
   * Cho den luc the san pham hien ra, khong cho den luc mang im han.
   *
   * Anh minh hoa cua danh muc lay tu dich vu anh ben ngoai, nen mang co the
   * con ban rat lau sau khi trang da dung duoc.
   */
  await page.goto(`${WEB}/products`, { waitUntil: 'load' });
  await settle(page);
  await page.waitForSelector('.card', { timeout: 30000 });
  await page.locator('.card').first().click();
  await page.waitForURL('**/products/**', { timeout: 20000 });
  await settle(page);
  await page.waitForSelector('.option', { timeout: 20000 });
  await page.locator('.option').first().click();
  await page.locator('button:has-text("Thêm vào giỏ")').first().click();
  await page.waitForFunction(
    () => document.querySelector('.cart-button .badge')?.textContent?.trim() === '2',
    { timeout: 20000 },
  );

  await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('.line-list .line', { timeout: 20000 });
  const lines = await page.locator('.line-list .line').count();
  ok('Gio chua duoc ca hai dong hang cung luc', lines === 2, `${lines} dong`);
  const tags = (await page.locator('.line .photo-tag').allInnerTexts()).map((one) => one.trim());
  ok('Gio phan biet duoc dong hang co san voi dong tuy bien',
    tags.some((one) => one.includes('có sẵn')) && new Set(tags).size === 2,
    tags.join(' | '));
  await page.screenshot({ path: path.join(OUT, 'goods-3-cart.png'), fullPage: true });

  // --- Dat don ---
  await page.locator('a:has-text("Tiến hành đặt hàng")').click();
  await page.waitForURL('**/checkout', { timeout: 20000 });
  await settle(page);
  await page.fill('input[formcontrolname="fullName"]', 'Khach mua ca hai');
  await page.fill('input[formcontrolname="phone"]', '0912345678');
  await page.fill('input[formcontrolname="address"]', '12 Duong Hang Hoa');
  await page.fill('input[formcontrolname="province"]', 'Ha Noi');
  await page.locator('button:has-text("Xác nhận và thanh toán")').click();
  await page.waitForURL('**/payments/**', { timeout: 20000 });
  const orderCode = page.url().split('/').pop();
  ok('Dat duoc mot don gom ca hai loai hang', Boolean(orderCode), String(orderCode));

  // --- Trang quan tri: them, sua, xoa ---
  await signIn(page, 'quanly@petmory.local', BOSS_PASSWORD);
  const bossToken = (await (await page.request.post(`${API}/auth/login`, {
    data: { email: 'quanly@petmory.local', password: BOSS_PASSWORD },
  })).json()).accessToken;
  await page.goto(`${WEB}/admin/goods`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector(ROW_GOODS, { timeout: 30000 });
  const listed = await page.locator(ROW_GOODS).count();
  ok('Trang quan tri liet ke hang co san', listed >= 6, String(listed));

  // --- Them mot mon moi ---
  const freshCode = `G-THU-${STAMP}`.slice(0, 20).toUpperCase();
  await page.locator('#goods-new').click();
  await page.waitForSelector(BOX_CODE, { timeout: 20000 });
  ok('Them mon hang mo ra hop thoai',
    (await page.locator(`.pm-dialog ${BOX_CODE}`).count()) === 1);
  ok('Bang liet ke van nam do phia sau hop thoai',
    (await page.locator(ROW_GOODS).count()) > 0);
  ok('Them mon moi thi ma go duoc', !(await page.locator(BOX_CODE).isDisabled()));
  await page.fill(BOX_CODE, freshCode);
  await page.fill(BOX_NAME, 'Mon thu tu bai kiem');
  await page.fill('#goods-days', '5');
  await page.locator(BOX_VARIANT).nth(0).fill('Co mot');
  await page.locator(BOX_VARIANT).nth(1).fill('THU-M1');
  await page.locator(BOX_VARIANT).nth(2).fill('99000');
  await page.locator(BOX_VARIANT).nth(3).fill('7');

  /*
   * Anh mon hang dan bang duong dan tren mang. O nay chi giu dia chi chu khong
   * tai anh ve, nen bai kiem khong phu thuoc vao mang ben ngoai.
   */
  await page.fill(BOX_IMAGE, 'khong phai duong dan');
  await page.locator(BTN_IMAGE).click();
  ok('Duong dan sai bi chan lai', (await page.locator(`${SHEET} .field-error`).count()) > 0);
  await page.fill(BOX_IMAGE, LINK_ONE);
  await page.locator(BTN_IMAGE).click();
  await page.fill(BOX_IMAGE, LINK_TWO);
  await page.locator(BTN_IMAGE).click();
  ok('Hai anh dan vao deu duoc giu', (await page.locator(`${SHEET} .shot`).count()) === 2,
    String(await page.locator(`${SHEET} .shot`).count()));
  ok('Anh dau tien duoc danh dau la anh chinh',
    (await page.locator(`${SHEET} .shot-lead`).count()) === 1);
  await page.locator(`${SHEET} .shot`).nth(1).locator('.shot-drop').click();
  ok('Bo bot mot anh thi con mot', (await page.locator(`${SHEET} .shot`).count()) === 1,
    String(await page.locator(`${SHEET} .shot`).count()));

  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForFunction(
    (want) => document.querySelector('#goods-table')?.textContent?.includes(want) ?? false,
    freshCode,
    { timeout: 30000 },
  );
  ok('Mon vua them hien ra trong bang', true);

  const madeRead = await (await page.request.get(`${API}/admin/goods/${freshCode}`, {
    headers: { Authorization: `Bearer ${bossToken}` },
  })).json();
  ok('Mon moi luu dung gia', madeRead.variant[0].price.$numberDecimal === '99000',
    String(madeRead.variant[0].price?.$numberDecimal));
  ok('Mon moi luu dung so ton', madeRead.variant[0].stock === 7,
    String(madeRead.variant[0].stock));
  ok('May chu giu lai dung mot duong dan anh',
    Array.isArray(madeRead.images) && madeRead.images.length === 1
      && madeRead.images[0] === LINK_ONE,
    JSON.stringify(madeRead.images));

  // --- Sua gia va so ton cua mot mon dang co ---
  /*
   * Cho hop thoai truoc dong han, roi cho den khi o ma mang dung ma mon dang
   * sua. Chi cho o ma hien ra thi chua du: hop thoai them mon cung co o do, va
   * khi may ban thi de doc trung hop thoai cu.
   */
  await page.waitForSelector(SHEET, { state: GONE, timeout: 20000 });
  await page.locator(BTN_EDIT_ON('G-BAT-AN')).click();
  await page.waitForFunction(
    (want) => document.querySelector(want.box)?.value === want.code,
    { box: '.pm-dialog #goods-code', code: 'G-BAT-AN' },
    { timeout: 20000 },
  );
  ok('Sua mon dang co thi ma bi khoa', await page.locator(`${SHEET} ${BOX_CODE}`).isDisabled());

  const priceBox = page.locator(BOX_VARIANT).nth(2);
  const stockBox = page.locator(BOX_VARIANT).nth(3);
  const priceBefore = await priceBox.inputValue();
  const stockBefore = Number(await stockBox.inputValue());
  await priceBox.fill(String(Number(priceBefore) + 5000));
  await stockBox.fill(String(stockBefore + 3));
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForSelector(STATUS_GOOD, { timeout: 30000 });

  const shown = await (await page.request.get(`${API}/goods/G-BAT-AN`)).json();
  ok('Sua duoc gia ban tu trang quan tri',
    shown.variant[0].price.$numberDecimal === String(Number(priceBefore) + 5000),
    `${priceBefore} -> ${shown.variant[0].price.$numberDecimal}`);
  ok('Sua so ton thi so moi duoc ghi nhan', shown.variant[0].stock === stockBefore + 3,
    `${stockBefore} -> ${shown.variant[0].stock}`);

  // So kho phai ghi lai phan chenh lech, du man hinh khong con bang lich su.
  const moves = await (await page.request.get(
    `${API}/admin/goods/G-BAT-AN/stock/${shown.variant[0].sku}`,
    { headers: { Authorization: `Bearer ${bossToken}` } },
  )).json();
  ok('So kho ghi lai lan vua sua', (moves ?? []).some((each) => each.delta === 3),
    String((moves ?? []).length));
  ok('So kho ghi ca so truoc va so sau',
    (moves ?? []).every((each) => typeof each.before === 'number' && typeof each.after === 'number'));

  // Tra gia va ton ve nhu cu de du lieu mau khong troi sau moi lan chay.
  await page.waitForSelector(SHEET, { state: GONE, timeout: 20000 });
  await page.locator(BTN_EDIT_ON('G-BAT-AN')).click();
  await page.waitForFunction(
    (want) => document.querySelector(want.box)?.value === want.code,
    { box: '.pm-dialog #goods-code', code: 'G-BAT-AN' },
    { timeout: 20000 },
  );
  await page.locator(BOX_VARIANT).nth(2).fill(priceBefore);
  await page.locator(BOX_VARIANT).nth(3).fill(String(stockBefore));
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForSelector(STATUS_GOOD, { timeout: 30000 });

  // --- Xoa mon vua them ---
  await page.locator(`#goods-table tbody tr:has-text("${freshCode}") button:has-text("Xóa")`).click();
  await page.waitForFunction(
    (want) => !(document.querySelector('#goods-table')?.textContent?.includes(want) ?? false),
    freshCode,
    { timeout: 30000 },
  );
  ok('Xoa duoc mon vua them', true);
  const gone = await page.request.get(`${API}/goods/${freshCode}`);
  ok('Mon da xoa khong con tren trang khach', gone.status() === 404, String(gone.status()));

  await page.screenshot({ path: path.join(OUT, 'goods-4-admin.png'), fullPage: true });

  // --- Nhom Quan tri vien khong vao duoc kho hang ---
  await signIn(page, 'quantri@petmory.local', BOSS_PASSWORD);
  await page.goto(`${WEB}/admin/goods`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  ok('Nhom Quan tri vien bi dua ra khoi man kho hang',
    !page.url().includes('/admin/goods'), page.url());

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
