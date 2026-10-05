/**
 * Browser test of the per-account pet profile limit (SOW item 2): the account
 * administrator sets a limit for one customer, the server enforces it, and
 * clearing it goes back to the shop default.
 * Run: node tools/test-accounts-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const ADMIN = { email: 'quantri@petmory.local', password: 'Petmory@2026' };
const EMAIL = `limit.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const res = [];
  try {
    console.log('PER-ACCOUNT PET LIMIT TEST');
    console.log('='.repeat(64));
    const made = await page.request.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Limit test' } });
    const customer = { Authorization: `Bearer ${(await made.json()).accessToken}` };

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', ADMIN.email);
    await page.fill('input[formcontrolname="password"]', ADMIN.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 20000 });
    await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'networkidle' });
    await page.fill('#account-search', EMAIL);
    await page.keyboard.press('Enter');
    await page.waitForFunction((email) => document.body.innerText.includes(email), EMAIL, { timeout: 15000 });

    await page.locator('tr', { hasText: EMAIL }).locator('.row-tools button').click();
    await page.waitForSelector('#account-pet-limit', { timeout: 10000 });
    res.push(check('The edit dialog offers a pet profile limit, empty means the shop default',
      (await page.inputValue('#account-pet-limit')) === ''));
    await page.fill('#account-pet-limit', '2');
    await page.screenshot({ path: path.join(OUT, 'accounts-pet-limit.png') });
    await page.click('#account-save');
    await page.waitForTimeout(1500);

    const pets = [];
    for (const name of ['Mot', 'Hai', 'Ba']) {
      const r = await page.request.post(`${API}/pets`, { headers: customer, data: { name } });
      pets.push(r.status());
    }
    res.push(check('The customer can create pets up to the limit', pets[0] === 201 && pets[1] === 201, pets.join(',')));
    res.push(check('The pet after the limit is refused', pets[2] >= 400, String(pets[2])));

    await page.locator('tr', { hasText: EMAIL }).locator('.row-tools button').click();
    await page.waitForSelector('#account-pet-limit', { timeout: 10000 });
    res.push(check('The dialog shows the saved limit', (await page.inputValue('#account-pet-limit')) === '2'));
    await page.fill('#account-pet-limit', '');
    await page.click('#account-save');
    await page.waitForTimeout(1500);
    const third = await page.request.post(`${API}/pets`, { headers: customer, data: { name: 'Ba' } });
    res.push(check('Clearing the limit goes back to the shop default', third.status() === 201, String(third.status())));

    await page.locator('tr', { hasText: EMAIL }).locator('.row-tools button').click();
    await page.waitForSelector('#account-pet-limit', { timeout: 10000 });
    await page.fill('#account-pet-limit', 'abc');
    res.push(check('A limit that is not a number is caught', (await page.locator('.field-error').count()) >= 1));
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
