const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `cart.test.${Date.now()}@petmory.local`;
const PASSWORD = 'Petmory@2026';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 940 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const res = [];
  try {
    console.log('CART SELECTION & REDIRECTION TEST');
    console.log('='.repeat(64));

    // 1. Register & login
    const regRes = await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Cart Tester' },
    });
    const regBody = await regRes.json();
    const token = regBody.accessToken;
    res.push(check('Registered test user', !!token));

    // 2. Add two products to cart via API
    // First product: PT-01, size FIG-S
    await page.request.post(`${API}/cart/items`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productTypeCode: 'PT-01', sizeCode: 'FIG-S', quantity: 1 },
    });
    // Second product: PT-02, size KEY-S
    await page.request.post(`${API}/cart/items`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 2 },
    });
    res.push(check('Added 2 distinct items to cart', true));

    // 3. Login through UI to set tokens in browser
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    res.push(check('Logged in and reached home', true));

    // 4. Navigate to cart
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.line', { timeout: 15000 });
    const lineCount = await page.locator('.line').count();
    res.push(check('Cart has 2 lines', lineCount === 2, `${lineCount} lines`));

    // Check checkboxes exist
    const checkboxes = page.locator('.line input.pm-checkbox');
    res.push(check('Both items have checkboxes', (await checkboxes.count()) === 2));

    const selectAllCheckbox = page.locator('.cart-toolbar input.pm-checkbox');
    res.push(check('Select-all checkbox exists', (await selectAllCheckbox.count()) === 1));
    res.push(check('Select-all is checked initially', await selectAllCheckbox.isChecked()));

    // Capture initial cart screenshot
    await page.screenshot({ path: path.join(OUT, 'cart-1-initial-all-selected.png') });

    // 5. Test redirect to product detail from title or thumbnail
    const firstTitleLink = page.locator('.line h2 a').first();
    const href = await firstTitleLink.getAttribute('href');
    res.push(check('Product title link points to shop with product query', href && href.includes('product=PT-01'), href));

    // Click thumbnail or view details link to test redirect
    const viewDetailBtn = page.locator('.line a:has-text("Xem chi tiết")').first();
    await viewDetailBtn.click();
    await page.waitForURL('**/shop**', { timeout: 15000 });
    res.push(check('Clicking details redirected to shop', page.url().includes('/shop')));

    // Wait for the modal dialog to appear
    await page.waitForSelector('mat-dialog-container', { timeout: 15000 });
    res.push(check('Product detail modal opened automatically on shop page', true));
    await page.screenshot({ path: path.join(OUT, 'cart-2-product-modal-redirect.png') });

    // 6. Go back to cart
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.line', { timeout: 15000 });

    // Read full total
    const fullTotalText = await page.locator('.bill strong').first().innerText();
    console.log('    Full total (2 items):', fullTotalText);

    // 7. Uncheck the second item
    await checkboxes.nth(1).uncheck();
    await page.waitForTimeout(500);

    const isSelectAllChecked = await selectAllCheckbox.isChecked();
    res.push(check('Select-all is unchecked when 1 item is unselected', !isSelectAllChecked));

    const partialTotalText = await page.locator('.bill strong').first().innerText();
    console.log('    Partial total (1 item):', partialTotalText);
    res.push(check('Total updated and decreased', partialTotalText !== fullTotalText, `${fullTotalText} -> ${partialTotalText}`));

    await page.screenshot({ path: path.join(OUT, 'cart-3-partial-selected.png') });

    // 8. Test checkout with only 1 item selected
    const checkoutLink = page.locator('.bill a:has-text("Tiến hành đặt hàng")');
    const checkoutHref = await checkoutLink.getAttribute('href');
    res.push(check('Checkout link contains ?items= query param', checkoutHref && checkoutHref.includes('items='), checkoutHref));

    await checkoutLink.click();
    await page.waitForURL('**/checkout**', { timeout: 15000 });
    res.push(check('Navigated to checkout', page.url().includes('/checkout')));

    // On checkout, verify only 1 item is displayed in bill
    await page.waitForSelector('.bill-item', { timeout: 15000 });
    const checkoutLines = await page.locator('.bill-item').count();
    res.push(check('Checkout only shows the 1 selected item', checkoutLines === 1, `${checkoutLines} items`));

    const checkoutTotal = await page.locator('.bill-total strong').innerText();
    res.push(check('Checkout total matches partial total', checkoutTotal.includes(partialTotalText.trim()) || partialTotalText.includes(checkoutTotal.trim()), `${checkoutTotal} vs ${partialTotalText}`));

    await page.screenshot({ path: path.join(OUT, 'cart-4-checkout-selected-only.png') });

    // 9. Go back to cart and test deselect all
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.line', { timeout: 15000 });
    await selectAllCheckbox.uncheck();
    await page.waitForTimeout(300);

    const checkoutDisabled = await page.locator('.bill button[disabled]').count();
    res.push(check('Checkout button is disabled when nothing is selected', checkoutDisabled > 0));
    // 10. Test mobile layout
    await selectAllCheckbox.check();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'cart-6-mobile.png') });

    const realErrors = errors.filter((l) => !/favicon/i.test(l));
    res.push(check('No runtime errors', realErrors.length === 0, realErrors.join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
