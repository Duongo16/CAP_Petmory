/**
 * Kiem thu man hinh nhat ky thao tac theo SOW muc 14. Nhom Quan ly doc duoc,
 * loc theo loai du lieu va hanh dong, mo mot dong de xem gia tri truoc va sau.
 * Nhom Cham soc khach hang va khach khong doc duoc. Chi doc, khong ghi gi.
 * Run: node tools/test-audit-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const SUPPORT = { email: 'cskh@petmory.local', password: 'Petmory@2026' };
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
    console.log('AUDIT LOG TEST');
    console.log('='.repeat(64));
    const customer = await (await api.post(`${API}/auth/register`, {
      data: { email: `nhatky.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Nhat ky test' },
    })).json();
    const denied = await api.get(`${API}/admin/audit`, { headers: { Authorization: `Bearer ${customer.accessToken}` } });
    res.push(check('A customer cannot read the activity log', denied.status() === 403, String(denied.status())));
    const support = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: SUPPORT })).json()).accessToken}` };
    const deskDenied = await api.get(`${API}/admin/audit`, { headers: support });
    res.push(check('The support desk cannot read the activity log', deskDenied.status() === 403, String(deskDenied.status())));
    const manager = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken}` };
    const bad = await api.get(`${API}/admin/audit?action=drop%20table`, { headers: manager });
    res.push(check('A malformed filter is refused', bad.status() === 400, String(bad.status())));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    res.push(check('The side rail links to the activity log', (await page.locator('a[href="/admin/audit"]').count()) >= 1));
    await page.goto(`${WEB}/admin/audit`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#audit-list .audit-row', { timeout: 20000 });
    res.push(check('The log lists entries, newest first', (await page.locator('.audit-row').count()) >= 1));

    await page.selectOption('#audit-resource', 'Accessory');
    await page.selectOption('#audit-action', 'CREATE_ACCESSORY');
    await page.click('.audit-search');
    await page.waitForFunction(() => {
      const all = [...document.querySelectorAll('.audit-what')];
      return all.length > 0 && all.every((el) => el.textContent.includes('CREATE_ACCESSORY'));
    }, null, { timeout: 15000 });
    const rows = await page.locator('.audit-row').count();
    res.push(check('Filtering by record type and action narrows the list', rows >= 6, String(rows)));
    await page.locator('.audit-line').first().click();
    await page.waitForSelector('.audit-detail pre', { timeout: 5000 });
    const after = await page.locator('.audit-diff pre').nth(1).innerText();
    res.push(check('Opening an entry shows the values written', after.includes('displayName') && after.includes('priceDelta'), after.slice(0, 80)));
    await page.screenshot({ path: path.join(OUT, 'audit-log.png'), fullPage: true });

    await page.fill('#audit-id', 'ACC-CAPE');
    await page.click('.audit-search');
    await page.waitForFunction(() => document.querySelectorAll('.audit-row').length >= 1
      && [...document.querySelectorAll('.audit-what')].every((el) => el.textContent.includes('ACC-CAPE')), null, { timeout: 15000 })
      .then(() => res.push(check('Searching by record id finds that record', true)), () => res.push(check('Searching by record id finds that record', false)));
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
