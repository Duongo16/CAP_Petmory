/**
 * Kiem thu trang Danh muc san pham va vat lieu (SOW muc 12, 13).
 *
 * Doc du lieu that tu may chu. Cac lan ghi (them, sua, bat tat) bi bai kiem tra
 * chan lai va tra loi thay may chu, de khong de lai muc thu tren co so du lieu
 * chung; bai kiem doc lai noi dung gui di. Phia may chu duoc kiem bang cac yeu
 * cau sai ma no phai tu choi, nen cung khong ghi gi.
 * Run: node tools/test-catalog-admin-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  const sent = [];
  try {
    console.log('CATALOG ADMIN TEST');
    console.log('='.repeat(64));
    const manager = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken}` };
    const customer = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/register`, {
      data: { email: `cat.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Catalog test' },
    })).json()).accessToken}` };

    // May chu: khach khong sua duoc, du lieu sai bi tu choi (khong co lan ghi nao thanh cong).
    const forbidden = await api.post(`${API}/catalog/packaging`, {
      headers: customer, data: { kind: 'BOX', code: 'HOP-THU', displayName: 'Hop thu', priceDelta: '1000' },
    });
    res.push(check('A customer cannot change the catalogue', forbidden.status() === 403, String(forbidden.status())));
    const badMoney = await api.post(`${API}/catalog/display-bases`, {
      headers: manager, data: { code: 'DE-THU', displayName: 'De thu', priceDelta: '10.5' },
    });
    res.push(check('A price with a fraction of a dong is refused', badMoney.status() === 400, String(badMoney.status())));
    const badSize = await api.post(`${API}/catalog/products/KHONG-CO-LOAI/sizes`, {
      headers: manager, data: { code: 'S', displayName: 'Nho', dimensions: '10cm', explainer: 'x', price: '1000', productionDays: 3, maxAccessories: 11 },
    });
    res.push(check('Too many accessories for a size is refused', badSize.status() === 400, String(badSize.status())));
    const badKind = await api.post(`${API}/catalog/packaging`, {
      headers: manager, data: { kind: 'BAG', code: 'TUI-THU', displayName: 'Tui', priceDelta: '0' },
    });
    res.push(check('An unknown packaging kind is refused', badKind.status() === 400, String(badKind.status())));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    res.push(check('The side rail links to the catalogue', (await page.locator('a[href="/admin/catalog"]').count()) >= 1));

    // Chan moi lan ghi vao danh muc, tra loi thay may chu bang chinh noi dung gui len.
    await page.route('**/api/catalog/**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.continue();
      }
      const body = route.request().postDataJSON();
      sent.push({ method, url: route.request().url(), body });
      return route.fulfill({ json: { ...body, code: body.code ?? 'X', sizes: [] } });
    });

    await page.goto(`${WEB}/admin/catalog`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.type-card', { timeout: 15000 });
    res.push(check('Product types load with their sizes',
      (await page.locator('.type-card').count()) >= 1 && (await page.locator('.size-row').count()) >= 1));

    const firstType = page.locator('.type-card').first();
    const typeCode = await firstType.getAttribute('data-type');
    await firstType.locator('.size-edit').first().click();
    await page.waitForSelector('#size-form', { timeout: 5000 });
    res.push(check('Editing a size locks its code', await page.locator('#size-form [data-field="code"]').isDisabled()));
    await page.fill('#size-form [data-field="price"]', '12.5');
    await page.click('#size-form .cat-save');
    res.push(check('A wrong price is caught on screen',
      await page.waitForSelector('#size-form .cat-error', { timeout: 5000 }).then(() => true, () => false) && sent.length === 0));
    await page.fill('#size-form [data-field="price"]', '990000');
    await page.fill('#size-form [data-field="maxAccessories"]', '2');
    await page.click('#size-form .cat-save');
    await page.waitForSelector('.pm-status[data-tone="good"]', { timeout: 10000 });
    const sizeCall = sent.at(-1);
    res.push(check('Saving a size sends price as whole dong and the accessory limit as a number',
      sizeCall?.method === 'PATCH' && sizeCall.url.includes(`/products/${typeCode}/sizes/`)
      && sizeCall.body.price === '990000' && sizeCall.body.maxAccessories === 2 && !('code' in sizeCall.body),
      JSON.stringify(sizeCall?.body)));

    await page.click('.type-new');
    await page.fill('#type-form [data-field="code"]', 'tuong-mini');
    await page.fill('#type-form [data-field="name"]', 'Tuong mini');
    await page.click('#type-form .cat-save');
    await page.waitForSelector('.pm-status[data-tone="good"]', { timeout: 10000 });
    const typeCall = sent.at(-1);
    res.push(check('A new product type is sent with an upper-case code',
      typeCall?.method === 'POST' && typeCall.body.code === 'TUONG-MINI' && typeCall.body.enabled === true, JSON.stringify(typeCall?.body)));

    await page.click('.catalog-tabs [data-tab="accessories"]');
    await page.waitForSelector('.cat-table tbody tr', { timeout: 15000 });
    res.push(check('The accessories tab lists the six accessories', (await page.locator('.cat-table tbody tr').count()) === 6));
    await page.locator('tr[data-code="ACC-CAPE"] .cat-toggle').click();
    await page.waitForSelector('.pm-status[data-tone="good"]', { timeout: 10000 });
    const toggleCall = sent.at(-1);
    res.push(check('Turning an accessory off sends only the switch',
      toggleCall?.url.endsWith('/catalog/accessories/ACC-CAPE') && JSON.stringify(toggleCall.body) === '{"enabled":false}', JSON.stringify(toggleCall?.body)));

    await page.click('.catalog-tabs [data-tab="packaging"]');
    await page.waitForSelector('.cat-new', { timeout: 15000 });
    await page.click('.cat-new');
    await page.selectOption('[data-field="kind"]', 'FRAME');
    await page.fill('[data-field="code"]', 'KHUNG-GO');
    await page.fill('[data-field="displayName"]', 'Khung go soi');
    await page.fill('[data-field="priceDelta"]', '80000');
    await page.click('.cat-save');
    await page.waitForSelector('.pm-status[data-tone="good"]', { timeout: 10000 });
    const frameCall = sent.at(-1);
    res.push(check('A new frame is sent with its kind and price',
      frameCall?.method === 'POST' && frameCall.body.kind === 'FRAME' && frameCall.body.priceDelta === '80000', JSON.stringify(frameCall?.body)));

    await page.click('.catalog-tabs [data-tab="display-bases"]');
    await page.waitForSelector('.cat-table tbody tr', { timeout: 15000 });
    res.push(check('The stands tab lists the stands', (await page.locator('.cat-table tbody tr').count()) >= 1));
    await page.screenshot({ path: path.join(OUT, 'catalog-admin.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    res.push(check('The page fits a phone without sideways scrolling', wide <= 390, String(wide)));
    res.push(check('No javascript error', errors.length === 0, errors.join(' | ').slice(0, 200)));
  } finally {
    await browser.close();
    await api.dispose();
  }
  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 300));
  process.exit(1);
});
