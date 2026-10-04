/**
 * Browser test of the payment log after the SePay changes: the five outcome
 * groups, that each group holds only its own outcomes, and the manager's
 * "reconcile with SePay" button.
 * Run: node tools/test-payment-log-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

/** Nhan cua tung ket qua trong nhom can kiem tra. */
const NEEDS_CHECK_LABELS = ['Thiếu tiền', 'Chuyển dư', 'Tiền về khi đơn không còn chờ'];

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const res = [];
  try {
    console.log('PAYMENT LOG TEST');
    console.log('='.repeat(64));
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 20000 });

    await page.goto(`${WEB}/admin/payment-log`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.log-filters .filter', { timeout: 20000 });
    const pills = page.locator('.log-filters .filter');
    res.push(check('The log offers five outcome groups', (await pills.count()) === 5));

    const figures = (await pills.allInnerTexts()).map((t) => Number(/\((\d+)\)/.exec(t)[1]));
    res.push(check('The group counts add up to the whole log',
      figures[0] === figures.slice(1).reduce((a, b) => a + b, 0), figures.join(' / ')));

    await pills.nth(2).click();
    await page.waitForTimeout(500);
    const needsCheck = await page.locator('.table tbody .status-chip').allInnerTexts();
    res.push(check('The needs-checking group holds only short, over and late payments',
      needsCheck.every((t) => NEEDS_CHECK_LABELS.includes(t.trim())), `${needsCheck.length} rows`));
    await pills.first().click();

    const button = page.locator('#reconcile-sepay');
    res.push(check('The manager sees the reconcile button', (await button.count()) === 1));
    await button.click();
    await page.waitForSelector('.reconcile-note', { timeout: 30000 });
    const note = (await page.locator('.reconcile-note').innerText()).trim();
    res.push(check('Reconciling reports a clear outcome', note.length > 10, note));
    await page.screenshot({ path: path.join(OUT, 'payment-log-sepay.png') });
  } finally {
    await browser.close();
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
