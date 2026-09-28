/**
 * Browser test: the order dispatch board, order detail, customer profiles and the
 * payment log. Also checks the difference between an operations account and one
 * that may only read.
 * Run: node tools/test-admin-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const PASSWORD_INTERNAL = 'Petmory@2026';
const CUSTOMER_PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function login(page, email, password, destination = '**/home') {
        // Any other session has to be signed out first, because the sign-in screen turns
        // away a user who is already signed in and sends them back to the home page.
  await page.goto(WEB, { waitUntil: 'networkidle' });
  const accountButton = page.locator('.account-button');
  if ((await accountButton.count()) > 0) {
    await accountButton.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 });
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(destination, { timeout: 20000 });
}

/** Uses the API to set up a customer with one paid order in advance. */
async function makeCustomerWithOrder(page, fullName) {
  const email = `gq.${Date.now()}@petmory.local`;
  const dk = await page.request.post(`${API}/auth/register`, {
    data: { email, password: CUSTOMER_PASSWORD, fullName },
  });
  const token = (await dk.json()).accessToken;
  const label = { Authorization: `Bearer ${token}` };

  await page.request.post(`${API}/cart/items`, {
    headers: label,
    data: { productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1 },
  });
  const order = await page.request.post(`${API}/orders`, {
    headers: label,
    data: {
      fullName,
      phone: '0987654321',
      address: '99 Duong XYZ',
      province: 'Da Nang',
    },
  });
  const orderCode = (await order.json()).orderCode;

  await page.request.post(`${API}/payments/webhook`, {
    headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
    data: { id: `gq-${Date.now()}`, transferAmount: 250000, content: `CT DEN ${orderCode}` },
  });
  return { email, fullName, orderCode };
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('INTERNAL OPERATIONS UI TEST');
    console.log('='.repeat(66));

    const customer = await makeCustomerWithOrder(page, 'Tran Thi Giao Dien');

                // --- A customer does not see the internal menu ---
    await login(page, customer.email, CUSTOMER_PASSWORD);
    res.push(check('A customer does not see the internal menu',
      (await page.locator('.internal-link').count()) === 0));

    await page.goto(`${WEB}/admin/orders`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    res.push(check('A customer is turned away from the operations screens',
      page.url().includes('/home'), page.url()));

                // --- The manager reaches the dispatch board ---
    await login(page, 'quanly@petmory.local', PASSWORD_INTERNAL);
    res.push(check('The manager sees all five internal menu items',
      (await page.locator('.internal-link').count()) === 5,
      (await page.locator('.internal-link').allInnerTexts()).join(' / ')));

    await page.locator('.internal-link').first().click();
    await page.waitForURL('**/admin/orders', { timeout: 20000 });
    await page.waitForSelector('.counter-tile', { timeout: 30000 });
    res.push(check('The dispatch board shows all ten statuses',
      (await page.locator('.counter-tile').count()) === 10));

    const totalBefore = Number(await page.locator('.counter-tile').nth(1).locator('.number').innerText());
    res.push(check('The paid tile carries real figures', totalBefore >= 1, `${totalBefore} orders`));
    await page.waitForSelector('.table tbody tr', { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, 'admin-1-orders-board.png') });

                // --- Filter by status ---
    await page.locator('.counter-tile').nth(1).click();
    await page.waitForTimeout(1200);
    const statusChip = await page.locator('.table tbody .status-chip').allInnerTexts();
    res.push(check('Clicking a tile filters by that status',
      statusChip.length > 0 && statusChip.every((t) => t.trim() === 'Đã thanh toán'),
      `${statusChip.length} dong`));
    res.push(check('The selected tile is marked',
      (await page.locator('.counter-tile.selected').count()) === 1));

                // --- Search ---
    await page.fill('#search-order', customer.orderCode);
    await page.locator('button:has-text("Tìm")').click();
    await page.waitForTimeout(1200);
    res.push(check('Searching by order code returns exactly one row',
      (await page.locator('.table tbody tr').count()) === 1));

    await page.locator('button:has-text("Bỏ lọc")').click();
    await page.waitForTimeout(1200);
    res.push(check('Clearing the filter returns the full list',
      (await page.locator('.counter-tile.selected').count()) === 0));

                // --- Order detail ---
    await page.goto(`${WEB}/admin/orders/${customer.orderCode}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.timeline li', { timeout: 20000 });
    const cardDelivery = page.locator('.card:has-text("Thông tin nhận hàng")');
    res.push(check('Detail shows the recipient name',
      (await cardDelivery.innerText()).includes(customer.fullName)));
    res.push(check('Detail shows the recipient phone number',
      (await cardDelivery.innerText()).includes('0987654321')));
    res.push(check('Detail carries the activity history',
      (await page.locator('.timeline li').count()) >= 1));

    const nodeTransition = await page.locator('.card:has-text("Chuyển trạng thái") button').allInnerTexts();
    res.push(check('Only legal transitions are offered',
      nodeTransition.map((t) => t.trim()).join('|') === 'Đang sản xuất|Đã hủy',
      nodeTransition.join('|')));
    await page.screenshot({ path: path.join(OUT, 'admin-2-order-detail.png') });

                // --- Status change with a reason ---
    await page.fill('#reason-input', 'workshop received the goods');
    await page.locator('button:has-text("Đang sản xuất")').click();
    await page.waitForTimeout(1500);
    const labelNext = (await page.locator('.status-chip.large').innerText()).trim();
    res.push(check('The order can be moved to in production', labelNext === 'Đang sản xuất', labelNext));

    const historyFirst = await page.locator('.timeline li').first().innerText();
    res.push(check('The reason is written into the history', historyFirst.includes('workshop received the goods')));
    res.push(check('History records who did it', historyFirst.includes('Quan ly PETMORY')));

    const nodeAfter = await page.locator('.card:has-text("Chuyển trạng thái") button').allInnerTexts();
    res.push(check('The list of next steps updates itself',
      nodeAfter.map((t) => t.trim()).join('|') === 'Kiểm tra chất lượng|Đã hủy',
      nodeAfter.join('|')));
    await page.screenshot({ path: path.join(OUT, 'admin-3-status-changed.png') });

                // --- Customer profile ---
    await page.goto(`${WEB}/admin/customers`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.table tbody tr', { timeout: 20000 });
    await page.fill('#search-customer', customer.email);
    await page.locator('button:has-text("Tìm")').click();
    await page.waitForTimeout(1200);
    res.push(check('A customer can be found by email',
      (await page.locator('.table tbody tr').count()) === 1));

    await page.locator('.table tbody a').first().click();
    await page.waitForURL(/admin\/customers\/[0-9a-f]{24}$/, { timeout: 20000 });
    await page.waitForSelector('.card', { timeout: 20000 });
    res.push(check('A customer profile shows their order history',
      (await page.locator('.table tbody tr').count()) === 1));
    res.push(check('A customer profile shows their email', (await page.locator('.description').innerText()).trim() === customer.email));
    await page.screenshot({ path: path.join(OUT, 'admin-4-customer-profile.png') });

                // --- Payment log ---
    await page.goto(`${WEB}/admin/payment-log`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.table tbody tr', { timeout: 20000 });
    res.push(check('The payment log has entries', (await page.locator('.table tbody tr').count()) >= 1));
    res.push(check('The payment log links through to the order',
      (await page.locator(`.table a:has-text("${customer.orderCode}")`).count()) >= 1));
    await page.screenshot({ path: path.join(OUT, 'admin-5-payment-log.png') });

                // --- Business settings page ---
    await page.goto(`${WEB}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form .card', { timeout: 30000 });
    res.push(check('The settings page shows all four groups',
      (await page.locator('form .card').count()) === 4));
    const accountNumber = await page.locator('input[formcontrolname="accountNumber"]').inputValue();
    res.push(check('Reads the current account number', accountNumber.length >= 6, accountNumber));
    res.push(check('Warns about the receiving account',
      (await page.locator('.note.warn').innerText()).includes('tiền của khách')));
    await page.screenshot({ path: path.join(OUT, 'admin-6-settings.png') });

                // Bad input is stopped in the interface itself, without calling the server
    await page.fill('input[formcontrolname="bankCode"]', '123');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForTimeout(800);
    res.push(check('A wrong bank code is rejected in the interface',
      (await page.locator('.field-error').count()) === 1));

    await page.fill('input[formcontrolname="bankCode"]', '970415');
    await page.fill('input[formcontrolname="warnShortEdgePx"]', '2000');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForTimeout(800);
    res.push(check('Rejects a warning threshold that is not below the acceptable one',
      (await page.locator('.error').innerText()).includes('nhỏ hơn')));

    await page.fill('input[formcontrolname="warnShortEdgePx"]', '600');
    await page.fill('input[formcontrolname="estimatedShippingDays"]', '4');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForSelector('.saved', { timeout: 20000 });
    res.push(check('A valid change can be saved', true));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('form .card', { timeout: 20000 });
    res.push(check('Reloading still shows the new value',
      (await page.locator('input[formcontrolname="estimatedShippingDays"]').inputValue()) === '4'));

                // Put the old value back so the other tests are unaffected
    await page.fill('input[formcontrolname="estimatedShippingDays"]', '3');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForSelector('.saved', { timeout: 20000 });

                // --- The support account may only read ---
    await login(page, 'cskh@petmory.local', PASSWORD_INTERNAL);
    await page.goto(`${WEB}/admin/orders/${customer.orderCode}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card', { timeout: 20000 });
    res.push(check('Support can still read the detail',
      (await page.locator('.timeline li').count()) >= 1));
    res.push(check('Support does not see the status button',
      (await page.locator('.card:has-text("Chuyển trạng thái") button').count()) === 0));
    res.push(check('There is an explanation of why it is read only',
      (await page.locator('.card:has-text("Chuyển trạng thái") .note').innerText()).includes('chỉ xem')));

    res.push(check('Support does not see the settings menu item',
      (await page.locator('a:has-text("Tham số")').count()) === 0));
    await page.goto(`${WEB}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    res.push(check('Support is turned away from the settings page',
      page.url().includes('/home'), page.url()));

                // --- A dispatcher can see the settings but not change them ---
    await login(page, 'xuong@petmory.local', PASSWORD_INTERNAL);
    await page.goto(`${WEB}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form .card', { timeout: 20000 });
    res.push(check('A workshop dispatcher can read the settings',
      (await page.locator('form .card').count()) === 4));
    res.push(check('A workshop dispatcher has no save button',
      (await page.locator('button:has-text("Lưu")').count()) === 0));
    res.push(check('Fields are locked for a read-only account',
      await page.locator('input[formcontrolname="accountNumber"]').isDisabled()));

    const realErrors = error.filter((l) => !/favicon/i.test(l));
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(66));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 700));
  process.exit(1);
});
