const { addCustomLine } = require('./lib/made-to-order');
/**
 * Browser test of the whole ordering flow, from the cart through to payment.
 * Run: node tools/test-checkout-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = process.env.SEPAY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `dh.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

/** Waits until the development server has finished compiling. */
async function settle(page) {
  for (let i = 0; i < 90; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 90 giay');
}

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 940 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('ORDERING FLOW BROWSER TEST');
    console.log('='.repeat(64));

    const registered = await (await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Checkout test' },
    })).json();
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });

                // Add a product to the cart
    await page.goto(`${WEB}/products/PT-02`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.picker .name', { timeout: 15000 });
    // Hang tuy bien khong them thang vao gio nua: nut dua sang studio voi san pham da chon (muc 7).
    await page.locator('button.to-cart').click();
    await page.waitForURL('**/studio?product=PT-02**', { timeout: 15000 });
    res.push(check('The product page leads into the customiser with the product chosen', page.url().includes('size=')));
    const line = await addCustomLine(registered.accessToken, { productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1 });
    await page.goto(`${WEB}/home`, { waitUntil: 'networkidle' });
    await page.waitForSelector('a[href="/cart"] [role="status"]', { timeout: 15000 });
    res.push(check('A product can be added to the cart', line.status === 201
      && (await page.locator('a[href="/cart"] [role="status"]').innerText()) === '1'));

                // Move on to the details form
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.locator('a:has-text("Tiến hành đặt hàng")').click();
    await page.waitForURL('**/checkout**', { timeout: 15000 });
    await page.waitForSelector('.form', { timeout: 15000 });
    res.push(check('The details form opens', true));

                // Submitting with details missing is blocked
    await page.locator('button:has-text("Xác nhận và thanh toán")').click();
    await page.waitForTimeout(600);
    res.push(check('Submitting with details missing is blocked', (await page.locator('.field-error').count()) > 0));

                // A badly formatted phone number
    await page.fill('input[formcontrolname="fullName"]', 'Nguyen Van A');
    await page.fill('input[formcontrolname="phone"]', '12345');
    await page.fill('input[formcontrolname="address"]', '12 Duong ABC, Phuong 1');
    await page.fill('input[formcontrolname="province"]', 'Ha Noi');
    await page.locator('button:has-text("Xác nhận và thanh toán")').click();
    await page.waitForTimeout(600);
    res.push(check('A badly formed telephone number is refused', page.url().includes('checkout')));
    await page.screenshot({ path: path.join(OUT, 'checkout-1-details-form.png') });

                // Fill it in correctly, then submit
    await page.fill('input[formcontrolname="phone"]', '0901234567');
    await page.locator('button:has-text("Xác nhận và thanh toán")').click();
    await page.waitForURL('**/payments/**', { timeout: 20000 });
    const orderCode = page.url().split('/').pop();
    res.push(check('The order is created and the payment page opens', Boolean(orderCode), orderCode));

    await page.waitForSelector('.qr-frame img', { timeout: 15000 });
    const srcQr = await page.locator('.qr-frame img').getAttribute('src');
    res.push(check('The payment code is drawn', Boolean(srcQr && srcQr.startsWith('data:image/png'))));

    const content = await page.locator('.copy-box.is-key code').innerText();
    res.push(check('The transfer message is the order code', content === orderCode, content));

    const amount = await page.locator('.due-money').innerText();
    res.push(check('The amount due is right', amount.includes('250.000'), amount));

    const steps = await page.locator('.stop.is-here .stop-name').innerText();
    res.push(check('The stepper marks the payment step', steps.includes('Thanh toán'), steps));

    const clock = await page.locator('.clock strong').innerText();
    res.push(check('The code shows how long it is good for',
      /^\d+:\d{2}(:\d{2})?$/.test(clock.trim()), clock));
    await page.screenshot({ path: path.join(OUT, 'checkout-2-payment.png') });

    // The cart must be empty once the order has been placed
    res.push(check('The cart badge is gone once the order is placed',
      (await page.locator('a[href="/cart"] [role="status"]').count()) === 0));

    // Send a transfer notification exactly as the real service would
    const bao1 = await page.request.post(`${API}/payments/webhook`, {
      headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
      data: { id: `web-${Date.now()}`, transferAmount: 250000, content: `CT DEN ${orderCode}` },
    });
    res.push(check('The transfer notice is matched to the order',
      (await bao1.json()).result === 'MATCHED'));

    // The page updates itself; nothing is refreshed by hand
    await page.waitForSelector('.done-mark', { timeout: 20000 });
    res.push(check('The page turns itself over when the money lands', true));
    res.push(check('The recap shows the order code',
      (await page.locator('.recap-rows dd').first().innerText()) === orderCode));
    await page.screenshot({ path: path.join(OUT, 'checkout-3-paid.png') });

    // Order list
    await page.locator('a:has-text("Xem đơn hàng")').click();
    await page.waitForURL('**/orders', { timeout: 15000 });
    await page.waitForSelector('.order', { timeout: 15000 });
    res.push(check('The order appears in the list', (await page.locator('.order').count()) === 1));

    const status = await page.locator('.chip-status').innerText();
    res.push(check('The order shows as paid', status.includes('Đã thanh toán'), status));

    res.push(check('A paid order no longer offers a pay button',
      (await page.locator('.deed-solid:has-text("Thanh toán")').count()) === 0));

    const done = await page.locator('.track-step.done').count();
    res.push(check('The workshop progress marks the paid stage', done === 2, `${done} stages`));

    await page.locator('.filter:has-text("Chờ thanh toán")').click();
    await page.waitForTimeout(400);
    res.push(check('Filtering by awaiting payment hides a paid order',
      (await page.locator('.order').count()) === 0));

    await page.locator('.filter:has-text("Tất cả")').click();
    await page.waitForTimeout(400);
    res.push(check('Clearing the filter brings the order back',
      (await page.locator('.order').count()) === 1));
    await page.screenshot({ path: path.join(OUT, 'checkout-4-order-list.png') });

    // --- A cancelled order must not look paid ---
    const access = await page.evaluate(() => localStorage.getItem('petmory.access'));
    const bearer = { Authorization: `Bearer ${access}` };
    const products = await (await page.request.get(`${API}/catalog/products`, { headers: bearer })).json();
    const product = products.find((p) => p.enabled && p.sizes.some((one) => one.enabled));
    await addCustomLine(access, { productTypeCode: product.code, sizeCode: product.sizes.find((one) => one.enabled).code, quantity: 1 });
    const placed = await (await page.request.post(`${API}/orders`, {
      headers: bearer,
      data: { fullName: 'Nguyen Van B', phone: '0901234567', address: '12 Duong ABC, Phuong 1', province: 'Ha Noi' },
    })).json();
    await page.request.post(`${API}/orders/${placed.orderCode}/cancel`, { headers: bearer });
    await page.goto(`${WEB}/payments/${placed.orderCode}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.cancelled, .done', { timeout: 20000 });
    res.push(check('A cancelled order shows as cancelled, not as paid',
      (await page.locator('.cancelled').count()) === 1 && (await page.locator('.done').count()) === 0));

    const realErrors = error.filter((l) => !/favicon/i.test(l));
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 160));
  process.exit(1);
});
