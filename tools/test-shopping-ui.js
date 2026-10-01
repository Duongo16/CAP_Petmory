/**
 * Browser test of the shopping flow: home page, product list, product detail, cart.
 * Run: node tools/test-shopping-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `mua.${Date.now()}@petmory.local`;
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
    console.log('SHOPPING FLOW TEST');
    console.log('='.repeat(64));

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Shopping test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    res.push(check('Signing in lands on the home page', true));

                // --- Home page ---
    await page.waitForSelector('.hero', { timeout: 15000 });
    res.push(check('The home page has two calls to action',
      (await page.locator('.hero .buttons a').count()) === 2));
    res.push(check('The home page has four selling points', (await page.locator('.point-item').count()) === 4));
    res.push(check('The home page has four process steps', (await page.locator('.step-item').count()) === 4));
    res.push(check('The home page shows the stories strip',
      (await page.locator('.story-card').count()) === 3));
    await page.screenshot({ path: path.join(OUT, 'shopping-1-home.png') });

                // --- Product list ---
    await page.locator('a:has-text("Khám phá")').click();
    await page.waitForURL('**/products', { timeout: 15000 });
    await page.waitForSelector('.card', { timeout: 15000 });
    const productCount = await page.locator('.card').count();
    res.push(check('The list shows every product type', productCount === 5, `${productCount} loai`));
    res.push(check('Every card carries a from price',
      (await page.locator('.buy-price strong').count()) === productCount));
    await page.screenshot({ path: path.join(OUT, 'shopping-2-product-list.png') });

                // --- Product detail ---
    await page.locator('.card .card-link').first().click();
    await page.waitForSelector('.picker .name', { timeout: 15000 });
    res.push(check('The detail page opens', true, await page.locator('.picker .name').innerText()));

    const countSize = await page.locator('.step').first().locator('.option').count();
    res.push(check('The sizes are shown', countSize === 3, `${countSize} sizes`));

    const material = await page.locator('.specs div').first().locator('dd').innerText();
    res.push(check('The material comes from the server', material.includes('tái chế'), material));

    const priceFirst = await page.locator('.price strong').innerText();
    await page.locator('.step').first().locator('.option').nth(2).click();
    await page.waitForTimeout(400);
    const priceAfter = await page.locator('.price strong').innerText();
    res.push(check('Changing the size changes the price', priceFirst !== priceAfter, `${priceFirst} -> ${priceAfter}`));

    await page.locator('.counter button').nth(1).click();
    await page.waitForTimeout(300);
    const priceOfTwo = await page.locator('.price strong').innerText();
    res.push(check('Raising the quantity changes the total', priceOfTwo !== priceAfter, `${priceAfter} -> ${priceOfTwo}`));
    await page.screenshot({ path: path.join(OUT, 'shopping-3-detail.png') });

                // --- Add to cart ---
    await page.locator('button:has-text("Thêm vào giỏ hàng")').click();
    await page.waitForTimeout(1200);
    const badge = await page.locator('.badge').innerText().catch(() => '0');
    res.push(check('The cart badge shows the right count', badge === '2', `shows ${badge}`));

                // --- Cart ---
    await page.locator('.cart-button').click();
    await page.waitForURL('**/cart', { timeout: 15000 });
    await page.waitForSelector('.line', { timeout: 15000 });
    res.push(check('The cart holds the item just added', (await page.locator('.line').count()) === 1));

    const cartTotal = await page.locator('.bill-total strong').innerText();
    res.push(check('The cart totals correctly', cartTotal === priceOfTwo, `${cartTotal}`));
    await page.screenshot({ path: path.join(OUT, 'shopping-4-cart.png') });

    await page.locator('.line .counter button').first().click();
    await page.waitForTimeout(900);
    res.push(check('A quantity can be lowered in the cart',
      (await page.locator('.bill-total strong').innerText()) !== cartTotal));

    await page.locator('.line-drop').click();
    await page.waitForTimeout(900);
    res.push(check('Removing the item empties the cart', (await page.locator('.pm-center').count()) > 0));

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
  console.error('Test error:', e.message.slice(0, 140));
  process.exit(1);
});
