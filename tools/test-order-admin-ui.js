const { addCustomLine } = require('./lib/made-to-order');
/**
 * Kiem thu quan tri don va khach (SOW muc 10): doi trang thai bang tay bat buoc
 * ly do, bo duoc co can xu ly kem ghi chu, danh sach khach khong lan tai khoan
 * noi bo. Don bi gan co bang mot lan tra du tien qua webhook thu.
 * Run: node tools/test-order-admin-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const WEBHOOK_KEY = process.env.SEPAY_WEBHOOK_KEY || 'change-this-key-before-running';
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
  try {
    console.log('ORDER AND CUSTOMER ADMIN TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, {
      data: { email: `donqt.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Don quan tri' },
    })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const manager = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken}` };
    await addCustomLine(made.accessToken, { productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1 });
    const order = await (await api.post(`${API}/orders`, {
      headers: auth, data: { fullName: 'Don Quan Tri', phone: '0901234567', address: '2 Duong Don', province: 'Hue' },
    })).json();
    const settings = await (await api.get(`${API}/settings`, { headers: manager })).json();
    const over = await api.post(`${API}/payments/webhook`, {
      headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
      data: { id: `over-${Date.now()}`, transferType: 'in', transferAmount: 999000, content: `CK ${order.reference}`, accountNumber: settings.accountNumber },
    });
    const flagged = await (await api.get(`${API}/admin/orders/${order.orderCode}`, { headers: manager })).json();
    res.push(check('An overpaid test order is flagged for attention', (flagged.order ?? flagged).needsAttention === true, String(over.status())));

    const noReason = await api.patch(`${API}/admin/orders/${order.orderCode}/status`, { headers: manager, data: { status: 'IN_PRODUCTION' } });
    res.push(check('Changing a status by hand without a reason is refused', noReason.status() === 400, String(noReason.status())));

    const customers = await (await api.get(`${API}/admin/customers?keyword=petmory.local&pageSize=50`, { headers: manager })).json();
    const emails = (customers.rows ?? []).map((one) => one.email);
    res.push(check('The customer list leaves out internal accounts',
      !emails.includes('quanly@petmory.local') && !emails.includes('cskh@petmory.local'), `${emails.length} rows`));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/admin/orders/${order.orderCode}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.attention', { timeout: 20000 });

    await page.locator('.button-row button').first().click();
    res.push(check('The screen asks for a reason before a manual status change',
      await page.waitForSelector('.error', { timeout: 5000 }).then(() => true, () => false)));

    await page.click('.attention-done');
    res.push(check('Clearing the flag needs a note', (await page.locator('.attention').count()) === 1));
    await page.fill('#attention-note', 'Da hoan 249000 cho khach qua chuyen khoan');
    await page.click('.attention-done');
    await page.waitForSelector('.attention', { state: 'detached', timeout: 15000 });
    res.push(check('With a note the flag is cleared', true));
    const after = await (await api.get(`${API}/admin/orders/${order.orderCode}`, { headers: manager })).json();
    res.push(check('The server keeps the flag cleared', (after.order ?? after).needsAttention === false));

    await page.fill('#reason-input', 'Xuong da nhan don');
    await page.locator('.button-row button').first().click();
    await page.waitForFunction(() => !document.querySelector('.error'), null, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const moved = await (await api.get(`${API}/admin/orders/${order.orderCode}`, { headers: manager })).json();
    res.push(check('With a reason the status changes', (moved.order ?? moved).status !== 'PAID', (moved.order ?? moved).status));
    await page.screenshot({ path: path.join(OUT, 'order-admin.png'), fullPage: true });
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
