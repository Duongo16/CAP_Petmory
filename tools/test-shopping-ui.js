/**
 * Browser test of the shopping flow: the Today page, the shop with its custom
 * tab, the product popup, and the cart.
 * Run: node tools/test-shopping-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { addCustomLine } = require('./lib/made-to-order');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `mua.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const FULL_NAME = 'Shopping test';
const PRODUCT = 'PT-01';
const POPUP = '.pm-dialog pm-product-detail-page';
const CART_LINK = 'header a[href="/cart"]';
const SHOP_LINK = 'header nav a[href="/shop"]';
const BILL_TOTAL = '.bill strong.text-accent-dark';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Only the digits of a money label, so formatting does not matter. */
function digits(text) {
  return Number(String(text).replace(/\D/g, ''));
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
      data: { email: EMAIL, password: PASSWORD, fullName: FULL_NAME },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    res.push(check('Signing in lands on the home page', true));

                // --- Today page ---
    await page.waitForSelector('.hello-line', { timeout: 15000 });
    const hello = await page.locator('.hello-line').innerText();
    res.push(check('The Today page greets the customer by name', hello.includes(FULL_NAME), hello));
    res.push(check('A new customer is invited to create a pet profile',
      (await page.locator('.blank a[href="/pets"]').count()) === 1));
    const navLinks = page.locator('header nav a');
    res.push(check('The main navigation has five links', (await navLinks.count()) === 5,
      String(await navLinks.count())));
    res.push(check('The navigation leads to the shop',
      (await page.locator(SHOP_LINK).innerText()).includes('Cửa hàng')));
    res.push(check('The cart starts without a badge',
      (await page.locator(`${CART_LINK} [role=status]`).count()) === 0));
    await page.screenshot({ path: path.join(OUT, 'shopping-1-home.png') });

                // --- Product list ---
    await page.locator(SHOP_LINK).click();
    await page.waitForURL('**/shop**', { timeout: 15000 });
    await page.waitForSelector('.card', { timeout: 15000 });
    res.push(check('The shop opens on the custom tab',
      (await page.locator('.shop-tabs .tw-tab.active').innerText()).includes('Kỷ vật')));
    const productCount = await page.locator('.card').count();
    res.push(check('The list shows every product type', productCount === 5, `${productCount} loai`));
    res.push(check('Every card carries a from price',
      (await page.locator('.buy-price strong').count()) === productCount));
    await page.screenshot({ path: path.join(OUT, 'shopping-2-product-list.png') });

    await page.goto(`${WEB}/products`, { waitUntil: 'networkidle' });
    const moved = new URL(page.url());
    res.push(check('The old product list address leads to the custom tab of the shop',
      moved.pathname === '/shop' && moved.searchParams.get('tab') === 'custom', page.url()));

                // --- Product detail popup ---
    await page.waitForSelector('.card', { timeout: 15000 });
    await page.locator(`.card .card-link[href*="product=${PRODUCT}"]`).click();
    await page.waitForSelector(`${POPUP} .picker .name`, { timeout: 15000 });
    res.push(check('The detail opens as a popup over the shop',
      new URL(page.url()).searchParams.get('product') === PRODUCT && (await page.locator('.card').count()) > 0,
      await page.locator(`${POPUP} .picker .name`).innerText()));

    const sizes = page.locator(`${POPUP} .step`).first().locator('.option');
    const countSize = await sizes.count();
    res.push(check('The sizes are shown', countSize === 3, `${countSize} sizes`));

    const material = await page.locator(`${POPUP} .picker dl div`).first().locator('dd').innerText();
    res.push(check('The material comes from the server', material.includes('tái chế'), material));

    const priceFirst = await page.locator(`${POPUP} .price strong`).innerText();
    await sizes.nth(2).click();
    await page.waitForTimeout(400);
    const priceAfter = await page.locator(`${POPUP} .price strong`).innerText();
    res.push(check('Changing the size changes the price', priceFirst !== priceAfter, `${priceFirst} -> ${priceAfter}`));
    const sizePrice = await sizes.nth(2).locator('.tw-badge-amber').innerText();
    await page.screenshot({ path: path.join(OUT, 'shopping-3-detail.png') });

    /*
     * Mon tuy bien khong bo thang vao gio duoc nua: nut tren cua so chi tiet
     * dua khach sang xuong thiet ke, mang theo loai va kich co vua chon.
     */
    const kind = await (await page.request.get(`${API}/catalog/products/${PRODUCT}`)).json();
    const sizeCode = kind.sizes[2].code;
    await page.locator(`${POPUP} .to-cart`).click();
    await page.waitForURL('**/studio**', { timeout: 15000 });
    const studio = new URL(page.url());
    res.push(check('Starting the design carries the product and size to the studio',
      studio.searchParams.get('product') === PRODUCT && studio.searchParams.get('size') === sizeCode, page.url()));
    res.push(check('Leaving the shop closes the popup', (await page.locator(POPUP).count()) === 0));

                // --- Add to cart ---
    /*
     * Dong tuy bien can mot ban thiet ke gan voi mot be du anh, nen bai kiem
     * chuan bi qua giao dien lap trinh roi moi xem gio tren man hinh.
     */
    const token = (await (await page.request.post(`${API}/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    })).json()).accessToken;
    const added = await addCustomLine(token, { productTypeCode: PRODUCT, sizeCode, quantity: 2 });
    res.push(check('The server accepts a custom line with a ready design', added.status === 201, String(added.status)));

    await page.goto(`${WEB}/shop`, { waitUntil: 'networkidle' });
    const badge = await page.locator(`${CART_LINK} [role=status]`).innerText().catch(() => '0');
    res.push(check('The cart badge shows the right count', badge.trim() === '2', `shows ${badge}`));

                // --- Cart ---
    await page.locator(CART_LINK).click();
    await page.waitForURL('**/cart', { timeout: 15000 });
    await page.waitForSelector('.line', { timeout: 15000 });
    res.push(check('The cart holds the item just added', (await page.locator('.line').count()) === 1));
    res.push(check('The line names the design it is made from',
      (await page.locator('.line .line-design-name').count()) === 1));

    const unit = await page.locator('.line .line-unit-price').innerText();
    res.push(check('The unit price matches the size picked', digits(unit) === digits(sizePrice), `${unit} / ${sizePrice}`));
    const cartTotal = await page.locator(BILL_TOTAL).innerText();
    res.push(check('The cart totals correctly', digits(cartTotal) === 2 * digits(sizePrice), `${cartTotal}`));
    await page.screenshot({ path: path.join(OUT, 'shopping-4-cart.png') });

    await page.locator('.line .line-stepper button').first().click();
    await page.waitForTimeout(900);
    res.push(check('A quantity can be lowered in the cart',
      (await page.locator('.line .line-stepper-val').innerText()).trim() === '1'
        && (await page.locator(BILL_TOTAL).innerText()) !== cartTotal));

    await page.locator('.line .line-remove-btn').click();
    await page.waitForTimeout(900);
    res.push(check('Removing the item empties the cart',
      (await page.locator('.line').count()) === 0 && (await page.locator('.tw-empty').innerText()).includes('trống')));

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
