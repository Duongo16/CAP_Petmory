/**
 * Browser test of the whole ordering flow, from the cart through to payment.
 * Run: node tools/test-checkout-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `dh.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

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

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Checkout test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });

                // Add a product to the cart
    await page.goto(`${WEB}/products/PT-02`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.product-name', { timeout: 15000 });
    await page.locator('button:has-text("Thêm vào giỏ hàng")').click();
    await page.waitForTimeout(1200);
    res.push(check('A product can be added to the cart', (await page.locator('.badge').innerText()) === '1'));

                // Move on to the details form
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.locator('a:has-text("Tiến hành đặt hàng")').click();
    await page.waitForURL('**/checkout', { timeout: 15000 });
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
    res.push(check('Chan count dien thoai sai vertex pending', page.url().includes('checkout')));
    await page.screenshot({ path: path.join(OUT, 'checkout-1-details-form.png') });

                // Fill it in correctly, then submit
    await page.fill('input[formcontrolname="phone"]', '0901234567');
    await page.locator('button:has-text("Xác nhận và thanh toán")').click();
    await page.waitForURL('**/payments/**', { timeout: 20000 });
    const orderCode = page.url().split('/').pop();
    res.push(check('The order is created and the payment page opens', Boolean(orderCode), orderCode));

    await page.waitForSelector('.qr-image', { timeout: 15000 });
    const srcQr = await page.locator('.qr-image').getAttribute('src');
    res.push(check('Show code QR', Boolean(srcQr && srcQr.startsWith('data:image/png'))));

    const content = await page.locator('.copyable').nth(1).locator('code').innerText();
    res.push(check('Show noi build transition khoan', content === orderCode, content));

    const amount = await page.locator('.amount').innerText();
    res.push(check('Show count money right return', amount.includes('250.000'), amount));
    await page.screenshot({ path: path.join(OUT, 'checkout-2-payment.png') });

    // The cart must be empty once the order has been placed
    res.push(check('Huy hieu gio ve wide', (await page.locator('.badge').count()) === 0));

    // Send a transfer notification exactly as the real service would
    const bao1 = await page.request.post(`${API}/payments/webhook`, {
      headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
      data: { id: `web-${Date.now()}`, transferAmount: 250000, content: `CT DEN ${orderCode}` },
    });
    res.push(check('Dich vu bao da label money', (await bao1.json()).result === 'MATCHED'));

    // The page updates itself; nothing is refreshed by hand
    await page.waitForSelector('.checkmark', { timeout: 20000 });
    res.push(check('Page word pair best when money ve', true));
    await page.screenshot({ path: path.join(OUT, 'checkout-3-paid.png') });

    // Order list
    await page.locator('a:has-text("Xem đơn hàng")').click();
    await page.waitForURL('**/orders', { timeout: 15000 });
    await page.waitForSelector('.order-row', { timeout: 15000 });
    res.push(check('The order appears in the list', (await page.locator('.order-row').count()) === 1));

    const status = await page.locator('.status-chip').innerText();
    res.push(check('The order shows as paid', status.includes('Đã thanh toán'), status));
    res.push(check('A paid order no longer offers a pay button', (await page.locator('.small').count()) === 0));
    await page.screenshot({ path: path.join(OUT, 'checkout-4-order-list.png') });

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
