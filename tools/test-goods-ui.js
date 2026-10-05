/**
 * Kiem thu tren trinh duyet luong mua hang co san, theo Phu luc 01 muc 23.
 *
 * Di het duong khach di: vao cua hang, sang the hang co san, loc, mo mot mon
 * trong cua so chi tiet, chon to hop, bo vao gio chung voi mot mon hang tuy
 * bien, dat don, roi mo trang quan tri de them mon, sua gia, ghi so kho va doc
 * lich su. Moi con so deu doc lai tu may chu sau do.
 *
 * Chay: node tools/test-goods-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { addCustomLine } = require('./lib/made-to-order');

/** Cac o tren man hinh duoc chi den nhieu lan, gom lai mot cho. */
const SHEET = '.pm-dialog';
const BOX_CODE = '#goods-code';
const BOX_IMAGE = '#goods-image';
const BTN_IMAGE = `${SHEET} pm-image-link .link-add`;
const LINK_ONE = 'https://placehold.co/600x400.png';
const LINK_TWO = 'https://placehold.co/300x200.png';
const BOX_NAME = '#goods-name';
const ROW_VARIANT = `${SHEET} .variant-row`;
const BOX_PRICE = 'input[formcontrolname="price"]';
const BTN_SAVE = `${SHEET} button[type=submit]:has-text("Lưu")`;
const ROW_OF = (code) => `#goods-table tbody tr:has-text("${code}")`;
const BTN_EDIT_ON = (code) => `${ROW_OF(code)} button:has-text("Sửa")`;
const STATUS_GOOD = '.pm-status[data-tone="good"]';
const STOCK_APPLY = `${SHEET} #stock-apply`;
const STOCK_NOTICE = `${SHEET} .stock-notice`;

const ROW_GOODS = '#goods-table tbody tr';
const CARD_GRID = 'pm-goods-list-page .card';
const DETAIL = `${SHEET} pm-goods-detail-page`;
const CART_BADGE = 'header a[href="/cart"] [role=status]';
const GONE = 'detached';
const KEPT = 'G-BAT-AN';

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `kh.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';
const BOSS_PASSWORD = 'Petmory@2026';
const DELIVERY = [
  ['#checkout-name', 'Khach mua ca hai'],
  ['#checkout-phone', '0912345678'],
  ['#checkout-address', '12 Duong Hang Hoa'],
  ['#checkout-province', 'Ha Noi'],
];

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

/**
 * Dang nhap qua chinh man hinh, sau khi da thoat tai khoan dang mo.
 *
 * Khach ve trang hom nay, nhan vien ve ban dieu hanh, nen chi cho den luc
 * roi khoi trang dang nhap.
 */
async function signIn(page, email, password) {
  await page.goto(WEB, { waitUntil: 'networkidle' });
  // Xoa phien dang mo ngay trong trinh duyet, khong phu thuoc nut dang xuat.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });
}

/** So phan tu khop, cho toi da nam giay de man hinh kip ve lai cho dung so mong doi. */
async function countSoon(page, selector, want) {
  for (let i = 0; i < 25; i += 1) {
    if ((await page.locator(selector).count()) === want) {
      return want;
    }
    await page.waitForTimeout(200);
  }
  return page.locator(selector).count();
}

/** Cho den khi o ma trong hop thoai mang dung ma mon dang sua. */
async function waitForSheetOf(page, code) {
  await page.waitForFunction(
    (want) => document.querySelector(want.box)?.value === want.code,
    { box: `${SHEET} ${BOX_CODE}`, code },
    { timeout: 20000 },
  );
}

/** Ghi mot dong so kho qua hop thoai so kho dang mo, cho den luc may chu nhan. */
async function writeStock(page, delta, note) {
  await page.fill(`${SHEET} #stock-delta`, String(delta));
  await page.fill(`${SHEET} #stock-note`, note);
  await page.locator(STOCK_APPLY).click();
  await page.waitForSelector(STOCK_NOTICE, { timeout: 20000 });
}

/**
 * Xoa cac mon do bai kiem nay va bai kiem luong mua hang co san tao ra o
 * nhung luot chay truoc.
 *
 * Moi bai tu xoa mon no vua tao o buoc cuoi, nhung mot luot hong giua chung
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
  const leftover = [];
  for (let at = 1, count = 1; at <= count; at += 1) {
    const listed = await (await fetch(`${API}/admin/goods?page=${at}`, { headers: head })).json();
    count = listed.pageCount ?? 1;
    leftover.push(...(listed.rows ?? []).filter((one) => one.code.startsWith('G-THU-')
      || (/^UI-\d+$/.test(one.code) && one.name.startsWith('Vong thu giao dien'))));
  }
  for (const one of leftover) {
    await fetch(`${API}/admin/goods/${one.code}`, { method: 'DELETE', headers: head });
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
  await page.locator('header nav a[href="/shop"]').click();
  await page.waitForURL('**/shop**', { timeout: 20000 });
  await settle(page);
  await page.locator('.shop-tabs .tw-tab:has-text("Hàng có sẵn")').click();
  await page.waitForURL((url) => url.searchParams.get('tab') === 'ready', { timeout: 20000 });
  await page.waitForSelector(CARD_GRID, { timeout: 30000 });
  ok('The hang co san trong cua hang duoc danh dau dang mo',
    (await page.locator('.shop-tabs .tw-tab.active').innerText()).includes('Hàng có sẵn'));
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

  // --- Mot mon co to hop het hang, mo trong cua so chi tiet ---
  await page.locator(CARD_GRID).first().click();
  await page.waitForURL((url) => url.searchParams.has('goods'), { timeout: 20000 });
  await settle(page);
  await page.waitForSelector(`${DETAIL} .variant`, { timeout: 20000 });
  ok('Mon hang mo trong cua so chi tiet ngay tren cua hang',
    (await page.locator(CARD_GRID).count()) > 0, page.url());
  const variant = page.locator(`${DETAIL} .variant`);
  ok('Mon nay co bon to hop', (await variant.count()) === 4, String(await variant.count()));
  ok('To hop het hang duoc danh dau', (await page.locator(`${DETAIL} .variant.gone`).count()) === 1,
    String(await page.locator(`${DETAIL} .variant.gone`).count()));
  ok('To hop het hang khong bam vao duoc',
    await page.locator(`${DETAIL} .variant.gone`).first().isDisabled());
  const left = (await page.locator(`${DETAIL} .tw-panel`).first().innerText()).replace(/\s+/g, ' ').trim();
  ok('Man hinh noi ro con bao nhieu mon trong kho', left.includes('Còn'), left);
  await page.screenshot({ path: path.join(OUT, 'goods-2-detail.png'), fullPage: true });

  // --- Bo vao gio ---
  await variant.first().click();
  await page.locator(`${DETAIL} button:has-text("Thêm vào giỏ")`).click();
  await page.locator(CART_BADGE).waitFor({ timeout: 20000 });
  ok('Bo vao gio thi bo dem tren thanh dieu huong tang',
    (await page.locator(CART_BADGE).innerText()).trim() === '1',
    (await page.locator(CART_BADGE).innerText()).trim());

  // --- Gio chua duoc ca hai dong hang ---
  /*
   * Dong tuy bien bat buoc co ban thiet ke gan voi mot be du anh, nen bai
   * kiem chuan bi dong do qua giao dien lap trinh roi moi mo gio.
   */
  const buyerToken = (await (await page.request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  })).json()).accessToken;
  const custom = await addCustomLine(buyerToken, { productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1 });
  ok('May chu nhan dong tuy bien co ban thiet ke', custom.status === 201, String(custom.status));

  await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('.line-list .line', { timeout: 20000 });
  ok('Bo dem gio hang tinh ca hai dong',
    (await page.locator(CART_BADGE).innerText()).trim() === '2',
    (await page.locator(CART_BADGE).innerText()).trim());
  const lines = await page.locator('.line-list .line').count();
  ok('Gio chua duoc ca hai dong hang cung luc', lines === 2, `${lines} dong`);
  const links = await page.locator('.line .line-title a').evaluateAll(
    (all) => all.map((one) => one.getAttribute('href') ?? ''),
  );
  ok('Gio phan biet duoc dong hang co san voi dong tuy bien',
    links.some((one) => one.includes('tab=ready')) && links.some((one) => one.includes('tab=custom')),
    links.join(' | '));
  ok('Chi dong tuy bien moi kem ban thiet ke',
    (await page.locator('.line .line-design').count()) === 1);
  await page.screenshot({ path: path.join(OUT, 'goods-3-cart.png'), fullPage: true });

  // --- Dat don ---
  await page.locator('a:has-text("Tiến hành đặt hàng")').click();
  await page.waitForURL('**/checkout**', { timeout: 20000 });
  await settle(page);
  for (const [box, value] of DELIVERY) {
    await page.fill(box, value);
  }
  await page.click('button[type=submit][form=checkout-form]');
  await page.waitForURL('**/payments/**', { timeout: 20000 });
  const orderCode = new URL(page.url()).pathname.split('/').pop();
  ok('Dat duoc mot don gom ca hai loai hang', /^PM\d+$/.test(orderCode), String(orderCode));

  // --- Trang quan tri: them, sua, ghi so kho, xoa ---
  await signIn(page, 'quanly@petmory.local', BOSS_PASSWORD);
  const bossToken = (await (await page.request.post(`${API}/auth/login`, {
    data: { email: 'quanly@petmory.local', password: BOSS_PASSWORD },
  })).json()).accessToken;
  const asBoss = { Authorization: `Bearer ${bossToken}` };
  await page.goto(`${WEB}/admin/goods`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector(ROW_GOODS, { timeout: 30000 });
  const listed = await page.locator(ROW_GOODS).count();
  ok('Trang quan tri liet ke hang co san', listed >= 6, String(listed));

  // --- Them mot mon moi co hai thuoc tinh ---
  const freshCode = `G-THU-${STAMP}`.slice(0, 20).toUpperCase();
  await page.locator('#goods-new').click();
  await page.waitForSelector(BOX_CODE, { timeout: 20000 });
  ok('Them mon hang mo ra hop thoai',
    (await page.locator(`${SHEET} ${BOX_CODE}`).count()) === 1);
  ok('Bang liet ke van nam do phia sau hop thoai',
    (await page.locator(ROW_GOODS).count()) > 0);
  ok('Them mon moi thi ma go duoc', !(await page.locator(BOX_CODE).isDisabled()));
  await page.fill(BOX_CODE, freshCode);
  await page.fill(BOX_NAME, 'Mon thu tu bai kiem');
  await page.fill('#goods-days', '5');
  await page.fill('#goods-option-1', 'Mau');
  await page.fill('#goods-option-2', 'Co');
  const firstRow = page.locator(ROW_VARIANT).first();
  await firstRow.locator('.value-1').fill('Do');
  await firstRow.locator('.variant-sku').fill('THU-M1');
  await firstRow.locator(BOX_PRICE).fill('99000');
  await firstRow.locator('.variant-stock').fill('7');

  /*
   * Anh mon hang dan bang duong dan tren mang. O nay chi giu dia chi chu khong
   * tai anh ve, nen bai kiem khong phu thuoc vao mang ben ngoai.
   */
  await page.fill(BOX_IMAGE, 'khong phai duong dan');
  await page.locator(BTN_IMAGE).click();
  ok('Duong dan sai bi chan lai', (await countSoon(page, `${SHEET} pm-image-link .field-error`, 1)) === 1);
  await page.fill(BOX_IMAGE, LINK_ONE);
  await page.locator(BTN_IMAGE).click();
  await page.fill(BOX_IMAGE, LINK_TWO);
  await page.locator(BTN_IMAGE).click();
  const shots = `${SHEET} .shot-item`;
  const kept = await countSoon(page, shots, 2);
  ok('Hai anh dan vao deu duoc giu', kept === 2, String(kept));
  ok('Anh dau tien duoc danh dau la anh chinh',
    (await page.locator(`${SHEET} .shot-lead`).count()) === 1);
  await page.locator(shots).nth(1).locator('.shot-drop').click();
  const after = await countSoon(page, shots, 1);
  ok('Bo bot mot anh thi con mot', after === 1, String(after));

  // Da dat ten thuoc tinh thu hai thi moi to hop phai co gia tri cho no.
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(`${SHEET} .field-error[role=alert]`, { timeout: 10000 });
  ok('Dat ten thuoc tinh thu hai ma bo trong gia tri thi bi chan',
    (await page.locator(`${SHEET} .field-error[role=alert]`).innerText()).includes('Co'));
  await firstRow.locator('.value-2').fill('M');

  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForFunction(
    (want) => document.querySelector('#goods-table')?.textContent?.includes(want) ?? false,
    freshCode,
    { timeout: 30000 },
  );
  ok('Mon vua them hien ra trong bang', true);

  const madeRead = await (await page.request.get(`${API}/admin/goods/${freshCode}`, { headers: asBoss })).json();
  ok('Mon moi luu dung gia', madeRead.variant[0].price.$numberDecimal === '99000',
    String(madeRead.variant[0].price?.$numberDecimal));
  ok('Mon moi luu dung so ton', madeRead.variant[0].stock === 7,
    String(madeRead.variant[0].stock));
  ok('Mon moi luu du hai thuoc tinh va gia tri cua to hop',
    JSON.stringify(madeRead.optionNames) === '["Mau","Co"]'
      && JSON.stringify(madeRead.variant[0].optionValues) === '["Do","M"]',
    `${JSON.stringify(madeRead.optionNames)} ${JSON.stringify(madeRead.variant[0].optionValues)}`);
  ok('May chu giu lai dung mot duong dan anh',
    Array.isArray(madeRead.images) && madeRead.images.length === 1
      && madeRead.images[0] === LINK_ONE,
    JSON.stringify(madeRead.images));

  // --- Sua gia cua mot mon dang co ---
  /*
   * Cho hop thoai truoc dong han, roi cho den khi o ma mang dung ma mon dang
   * sua. Chi cho o ma hien ra thi chua du: hop thoai them mon cung co o do, va
   * khi may ban thi de doc trung hop thoai cu.
   */
  await page.waitForSelector(SHEET, { state: GONE, timeout: 20000 });
  await page.locator(BTN_EDIT_ON(KEPT)).click();
  await waitForSheetOf(page, KEPT);
  ok('Sua mon dang co thi ma bi khoa', await page.locator(`${SHEET} ${BOX_CODE}`).isDisabled());
  ok('So ton cua to hop da luu khong sua thang duoc, phai qua so kho',
    await page.locator(ROW_VARIANT).first().locator('.variant-stock').isDisabled());

  const priceBox = page.locator(ROW_VARIANT).first().locator(BOX_PRICE);
  const priceBefore = await priceBox.inputValue();
  await priceBox.fill(String(Number(priceBefore) + 5000));
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForSelector(STATUS_GOOD, { timeout: 30000 });

  const priced = await (await page.request.get(`${API}/goods/${KEPT}`)).json();
  ok('Sua duoc gia ban tu trang quan tri',
    priced.variant[0].price.$numberDecimal === String(Number(priceBefore) + 5000),
    `${priceBefore} -> ${priced.variant[0].price.$numberDecimal}`);
  const stockBefore = priced.variant[0].stock;
  const sku = priced.variant[0].sku;

  // --- Ghi so kho ---
  await page.locator(`${ROW_OF(KEPT)} .stock-open`).click();
  await page.waitForSelector(`${SHEET} #stock-delta`, { timeout: 20000 });
  ok('So kho mo dung to hop dau tien',
    (await page.locator(`${SHEET} .sku.on`).getAttribute('data-sku')) === sku);
  await page.fill(`${SHEET} #stock-delta`, '3');
  await page.fill(`${SHEET} #stock-note`, 'ab');
  await page.locator(STOCK_APPLY).click();
  ok('Ly do qua ngan thi so kho tu choi',
    (await countSoon(page, `${SHEET} .stock-alert`, 1)) === 1);

  await writeStock(page, 3, 'Kiem thu giao dien nhap them');
  ok('So ton tren so kho tang dung phan vua nhap',
    (await page.locator(`${SHEET} .sku.on .sku-stock`).innerText()).trim() === String(stockBefore + 3),
    (await page.locator(`${SHEET} .sku.on .sku-stock`).innerText()).trim());
  await page.waitForFunction(
    () => document.querySelector('#stock-history tbody tr .delta')?.textContent?.trim() === '+3',
    undefined,
    { timeout: 20000 },
  );
  ok('Lich su so kho hien dong vua ghi o tren cung', true);

  const shown = await (await page.request.get(`${API}/goods/${KEPT}`)).json();
  ok('Ghi so kho thi so ton moi duoc ghi nhan', shown.variant[0].stock === stockBefore + 3,
    `${stockBefore} -> ${shown.variant[0].stock}`);

  const moves = await (await page.request.get(
    `${API}/admin/goods/${KEPT}/stock/${sku}`,
    { headers: asBoss },
  )).json();
  ok('So kho ghi lai lan vua sua', (moves ?? []).some((each) => each.delta === 3),
    String((moves ?? []).length));
  ok('So kho ghi ca so truoc va so sau',
    (moves ?? []).every((each) => typeof each.before === 'number' && typeof each.after === 'number'));

  // Tra so ton va gia ve nhu cu de du lieu mau khong troi sau moi lan chay.
  await writeStock(page, -3, 'Kiem thu giao dien tra lai');
  await page.locator(`${SHEET} .shut`).click();
  await page.waitForSelector(SHEET, { state: GONE, timeout: 20000 });
  await page.locator(BTN_EDIT_ON(KEPT)).click();
  await waitForSheetOf(page, KEPT);
  await page.locator(ROW_VARIANT).first().locator(BOX_PRICE).fill(priceBefore);
  await page.locator(BTN_SAVE).click();
  await page.waitForSelector(BTN_SAVE, { state: GONE, timeout: 20000 });
  await page.waitForSelector(STATUS_GOOD, { timeout: 30000 });
  const restored = await (await page.request.get(`${API}/goods/${KEPT}`)).json();
  ok('Gia va so ton tro ve nhu cu',
    restored.variant[0].price.$numberDecimal === priceBefore && restored.variant[0].stock === stockBefore,
    `${restored.variant[0].price.$numberDecimal} / ${restored.variant[0].stock}`);

  // --- Xoa mon vua them ---
  await page.locator(`${ROW_OF(freshCode)} button:has-text("Xóa")`).click();
  await page.waitForFunction(
    (want) => !(document.querySelector('#goods-table')?.textContent?.includes(want) ?? false),
    freshCode,
    { timeout: 30000 },
  );
  ok('Xoa duoc mon vua them', true);
  const gone = await page.request.get(`${API}/goods/${freshCode}`);
  ok('Mon da xoa khong con tren trang khach', gone.status() === 404, String(gone.status()));

  await page.screenshot({ path: path.join(OUT, 'goods-4-admin.png'), fullPage: true });

  // --- Nhom Cham soc khach hang khong vao duoc kho hang ---
  await signIn(page, 'cskh@petmory.local', BOSS_PASSWORD);
  await page.goto(`${WEB}/admin/goods`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  ok('Nhom CSKH bi dua ra khoi man kho hang',
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
