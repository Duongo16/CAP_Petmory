const { readyDesign, passPhotoStep } = require('./lib/made-to-order');
/**
 * Kiem thu hop va khung trong luong dat hang cua khach (SOW muc 12).
 *
 * Khach chon hop va khung o buoc hoan tat cua studio, moi loai mot mau. Gia doc
 * tu danh muc do Quan ly dat, cong vao bao gia, chot vao dong gio hang va dong
 * don, roi hien trong ho so san xuat. Quan ly doi gia thi bao gia moi doi theo
 * nhung don da dat giu nguyen gia cu.
 * Run: node tools/test-packaging-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `pack.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');

/** Kich co dung xuyen suot bai kiem. */
const KIND = 'PT-01';
const SIZE = 'FIG-M';
const BOX = 'BOX-GIFT';
const FRAME = 'FRAME-ACRYLIC';
const QUOTE_PRICE = '.quote-price';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

const digits = (text) => Number(String(text).replace(/\D/g, ''));
const money = (value) => digits(value?.$numberDecimal ?? value);

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  let manager = null;
  let boxPriceBefore = null;
  try {
    console.log('BOX AND FRAME ORDER FLOW TEST');
    console.log('='.repeat(64));

    // --- Danh muc va bao gia ---
    const catalog = await (await api.get(`${API}/catalog/packaging`)).json();
    const price = Object.fromEntries(catalog.map((one) => [one.code, money(one.priceDelta)]));
    res.push(check('The shop offers boxes and frames',
      catalog.some((one) => one.kind === 'BOX') && catalog.some((one) => one.kind === 'FRAME'),
      catalog.map((one) => one.code).join(', ')));

    const made = await (await api.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Hop khung test' },
    })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };

    const plain = await (await api.get(`${API}/designs/quote`, {
      headers: auth, params: { productTypeCode: KIND, sizeCode: SIZE },
    })).json();
    const both = await (await api.get(`${API}/designs/quote`, {
      headers: auth, params: { productTypeCode: KIND, sizeCode: SIZE, packaging: `${BOX},${FRAME}` },
    })).json();
    res.push(check('The quote adds the box and frame prices from the catalog',
      digits(both.totalPrice) === digits(plain.totalPrice) + price[BOX] + price[FRAME]
      && digits(both.packagingPrice) === price[BOX] + price[FRAME],
      `${plain.totalPrice} -> ${both.totalPrice}`));

    const twoBoxes = await api.get(`${API}/designs/quote`, {
      headers: auth, params: { productTypeCode: KIND, sizeCode: SIZE, packaging: `${BOX},BOX-WOOD` },
    });
    res.push(check('Two boxes on one line are refused', twoBoxes.status() === 400, String(twoBoxes.status())));
    const unknown = await api.get(`${API}/designs/quote`, {
      headers: auth, params: { productTypeCode: KIND, sizeCode: SIZE, packaging: 'BOX-KHONG-CO' },
    });
    res.push(check('An unknown box code is refused', unknown.status() === 400, String(unknown.status())));

    // --- Gio hang va don ---
    const ready = await readyDesign(made.accessToken, { productTypeCode: KIND, sizeCode: SIZE });
    const cart = await (await api.post(`${API}/cart/items`, {
      headers: auth,
      data: { productTypeCode: KIND, sizeCode: SIZE, quantity: 1, designId: ready.designId, packagingCodes: [BOX, FRAME] },
    })).json();
    const line = cart.items?.[0];
    res.push(check('The cart line is priced with the box and frame',
      digits(line?.unitPrice) === digits(both.totalPrice), String(line?.unitPrice)));
    res.push(check('The cart line keeps the chosen box and frame',
      (line?.packaging ?? []).map((one) => one.code).sort().join(',') === [BOX, FRAME].sort().join(',')));

    // --- Giao dien: buoc hoan tat cua studio va gio hang ---
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });

    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.pack-chip', { timeout: 20000 });
    const chips = await page.locator('.pack-chip').allInnerTexts();
    res.push(check('The cart shows the box and frame on the line', chips.length === 2, chips.join(' | ')));

    // Be cua ban thiet ke san da du anh, nen dung mau tu anh o buoc mot duoc ngay.
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#studio-pet', { timeout: 40000 });
    res.push(check('The studio opens on the pet photo step with the finish step locked',
      (await page.locator('[data-step="PHOTOS"]').getAttribute('aria-selected')) === 'true'
        && (await page.locator('[data-step="FINISH"]').isDisabled())));
    await passPhotoStep(page, ready.petId);
    await page.waitForSelector('.model[data-model]', { timeout: 40000 });
    await page.locator('.model[data-model="BASE-DOG-SIT"]').click();
    await page.waitForTimeout(2000);
    await page.locator('[data-step="FINISH"]').click();
    await page.locator('.product:has-text("Tượng len chọc")').click();
    await page.locator('.chip:has-text("Vừa")').click();
    await page.waitForSelector(QUOTE_PRICE, { timeout: 20000 });
    const before = digits(await page.locator(QUOTE_PRICE).innerText());

    const boxChips = page.locator('[data-pack="BOX"] .chip');
    const frameChips = page.locator('[data-pack="FRAME"] .chip');
    res.push(check('The finish step offers each box plus a none choice',
      (await boxChips.count()) === catalog.filter((one) => one.kind === 'BOX').length + 1,
      String(await boxChips.count())));
    res.push(check('The finish step offers each frame plus a none choice',
      (await frameChips.count()) === catalog.filter((one) => one.kind === 'FRAME').length + 1,
      String(await frameChips.count())));
    res.push(check('Nothing is picked at first',
      (await boxChips.first().getAttribute('aria-pressed')) === 'true'
      && (await frameChips.first().getAttribute('aria-pressed')) === 'true'));

    await page.locator(`[data-pack="BOX"] .chip[data-code="${BOX}"]`).click();
    await page.waitForFunction(
      (want) => Number(document.querySelector(want.sel)?.textContent?.replace(/\D/g, '') ?? 0) === want.total,
      { sel: QUOTE_PRICE, total: before + price[BOX] },
      { timeout: 15000 },
    ).catch(() => undefined);
    const withBox = digits(await page.locator(QUOTE_PRICE).innerText());
    res.push(check('Picking a box raises the price by its catalog price', withBox === before + price[BOX], `${before} -> ${withBox}`));
    res.push(check('The price breakdown names the box', (await page.locator('.pack-line').innerText()).includes('Hộp quà')));

    await page.locator(`[data-pack="BOX"] .chip[data-code="BOX-WOOD"]`).click();
    await page.waitForTimeout(1200);
    res.push(check('Picking another box replaces the first',
      (await page.locator(`[data-pack="BOX"] .chip[data-code="${BOX}"]`).getAttribute('aria-pressed')) === 'false'
      && (await page.locator('[data-pack="BOX"] .chip[data-code="BOX-WOOD"]').getAttribute('aria-pressed')) === 'true'));
    await page.screenshot({ path: path.join(OUT, 'packaging-studio.png') });

    await boxChips.first().click();
    await page.waitForTimeout(1200);
    res.push(check('Choosing none takes the box price back off',
      digits(await page.locator(QUOTE_PRICE).innerText()) === before && (await page.locator('.pack-line').count()) === 0));

    // --- Dat don, ho so san xuat va gia do Quan ly dat ---
    const order = await (await api.post(`${API}/orders`, {
      headers: auth,
      data: { fullName: 'Hop khung test', phone: '0901234567', address: '12 Duong ABC', province: 'Ha Noi' },
    })).json();
    const row = order.rows?.[0];
    res.push(check('The order freezes the box and frame with their prices',
      (row?.packaging ?? []).length === 2 && money(row.packaging.find((one) => one.code === BOX)?.priceDelta) === price[BOX]));

    const login = await (await api.post(`${API}/auth/login`, { data: MANAGER })).json();
    manager = { Authorization: `Bearer ${login.accessToken}` };
    const file = await (await api.get(`${API}/admin/orders/${order.orderCode}/production-file`, { headers: manager })).json();
    res.push(check('The production file lists the box and frame for the workshop',
      (file.items?.[0]?.packaging ?? []).length === 2,
      (file.items?.[0]?.packaging ?? []).map((one) => one.displayName).join(', ')));

    boxPriceBefore = String(price[BOX]);
    const raised = String(price[BOX] + 10000);
    const patch = await api.patch(`${API}/catalog/packaging/${BOX}`, { headers: manager, data: { priceDelta: raised } });
    res.push(check('The manager can set the box price', patch.ok(), String(patch.status())));
    const newer = await (await api.get(`${API}/designs/quote`, {
      headers: auth, params: { productTypeCode: KIND, sizeCode: SIZE, packaging: BOX },
    })).json();
    res.push(check('A new quote follows the new price', digits(newer.packagingPrice) === Number(raised), newer.packagingPrice));
    const again = await (await api.get(`${API}/orders/${order.orderCode}`, { headers: auth })).json();
    res.push(check('The placed order keeps the old price', digits(again.total) === digits(order.total),
      `${JSON.stringify(order.total)} / ${JSON.stringify(again.total)}`));

    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
  } finally {
    // Tra gia hop ve nhu cu de cac bai kiem khac khong bi anh huong.
    if (manager && boxPriceBefore !== null) {
      await api.patch(`${API}/catalog/packaging/${BOX}`, { headers: manager, data: { priceDelta: boxPriceBefore } });
    }
    await browser.close();
    await api.dispose();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
