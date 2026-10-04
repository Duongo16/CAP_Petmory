/**
 * Browser test of the "My designs" page and of the cart telling which design
 * each line carries: list, preview pictures, rename without losing paint, add
 * to cart, the delete guard while in the cart, and the way back to the studio.
 * Run: node tools/test-designs-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `designs.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** A small stand-in preview picture, in the raster format the browser produces. */
function previewPng() {
  return sharp({ create: { width: 96, height: 96, channels: 3, background: '#e8b27a' } }).png().toBuffer();
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/409|Conflict/.test(m.text()) && error.push(m.text()));

  const res = [];
  try {
    console.log('MY DESIGNS AND CART TEST');
    console.log('='.repeat(64));

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Designs test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    const token = await page.evaluate(() => localStorage.getItem('petmory.access'));
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    // --- Two designs made through the API: one ready to order, one draft ---
    const products = await (await page.request.get(`${API}/catalog/products`, auth)).json();
    const product = products.find((p) => p.enabled && p.sizes.some((s) => s.enabled));
    const size = product.sizes.find((s) => s.enabled);
    const ready = await (await page.request.post(`${API}/designs`, {
      ...auth,
      data: {
        name: 'Mun deo vong', modelCode: 'Q-PUG', productTypeCode: product.code, sizeCode: size.code,
        engraving: { name: 'Mun' }, stand: { baseCode: 'BASE-ROUND', tone: 'OAK', decorations: ['HEART'] },
        paint: [{ mesh: 'Pug', color: 'aabbccddeeff' }],
      },
    })).json();
    const png = await previewPng();
    await page.request.post(`${API}/designs/${ready._id}/preview`, {
      headers: auth.headers,
      multipart: { angle: 'ISO', file: { name: 'ISO.png', mimeType: 'image/png', buffer: png } },
    });
    const draft = await (await page.request.post(`${API}/designs`, {
      ...auth,
      data: { name: 'Ban nhap', modelCode: 'Q-SHIBA', paint: [{ mesh: 'Shiba', color: '112233' }] },
    })).json();

    // --- The list ---
    await page.goto(`${WEB}/designs`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.card[data-design]', { timeout: 20000 });
    res.push(check('My designs lists both saved designs', (await page.locator('.card[data-design]').count()) === 2));
    const readyCard = page.locator(`.card[data-design="${ready._id}"]`);
    const draftCard = page.locator(`.card[data-design="${draft._id}"]`);
    await page.waitForFunction(
      (id) => {
        const img = document.querySelector(`.card[data-design="${id}"] pm-design-preview img`);
        return Boolean(img && img.complete && img.naturalWidth > 0);
      },
      ready._id,
      { timeout: 15000 },
    );
    res.push(check('The saved preview picture shows on the card', true));
    res.push(check('A design with product and size is ready to order',
      (await readyCard.locator('.stage').getAttribute('data-stage')) === 'READY'));
    res.push(check('A design without product is a draft',
      (await draftCard.locator('.stage').getAttribute('data-stage')) === 'DRAFT'));
    const facts = await readyCard.locator('.facts').innerText();
    res.push(check('The card names the model, stand and engraving',
      facts.includes('Pug') && facts.includes('Gỗ tròn') && facts.includes('Mun'), facts.replace(/\s+/g, ' ')));

    // --- Rename keeps the paint ---
    await draftCard.locator('.rename-button').click();
    await draftCard.locator('input[name="name"]').fill('Shiba cua Bong');
    await draftCard.locator('button[type="submit"]').click();
    await page.waitForFunction((id) => document.querySelector(`.card[data-design="${id}"] .name`)?.textContent?.includes('Shiba cua Bong'), draft._id, { timeout: 15000 });
    const renamed = await (await page.request.get(`${API}/designs/${draft._id}`, auth)).json();
    res.push(check('Renaming saves the new name', renamed.name === 'Shiba cua Bong'));
    res.push(check('Renaming does not wipe the painted colours', renamed.paint?.[0]?.color === '112233'));

    // --- Add to cart from the list ---
    await readyCard.locator('button:has-text("Thêm vào giỏ")').click();
    await page.waitForFunction((id) => document.querySelector(`.card[data-design="${id}"] .stage`)?.getAttribute('data-stage') === 'IN_CART', ready._id, { timeout: 15000 });
    res.push(check('Adding to cart marks the card as in the cart', true));
    await page.screenshot({ path: path.join(OUT, 'designs-1-list.png') });

    // --- Delete guard while in the cart ---
    await readyCard.locator('.delete-button').click();
    await readyCard.locator('.danger-button').click();
    await page.waitForSelector('.notice.danger', { timeout: 15000 });
    res.push(check('A design in the cart cannot be deleted', (await page.locator(`.card[data-design="${ready._id}"]`).count()) === 1,
      (await page.locator('.notice.danger').innerText()).trim()));

    // --- The cart tells which design each line carries ---
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.line-design-name', { timeout: 20000 });
    res.push(check('The cart line names the design', (await page.locator('.line-design-name').innerText()).trim() === 'Mun deo vong'));
    await page.waitForFunction(() => {
      const img = document.querySelector('.line-thumb-design pm-design-preview img');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, null, { timeout: 15000 });
    res.push(check('The cart line shows the design picture instead of the catalogue one', true));
    const editHref = await page.locator('.line-design a').getAttribute('href');
    res.push(check('The cart line links back to the studio with this design', (editHref ?? '').includes(`draft=${ready._id}`), editHref));
    await page.screenshot({ path: path.join(OUT, 'designs-2-cart.png') });

    await page.locator('.line-design a').click();
    await page.waitForURL('**/studio?draft=*', { timeout: 15000 });
    await page.waitForSelector('.name-chip', { timeout: 40000 });
    await page.waitForTimeout(1200);
    res.push(check('Editing from the cart opens the design in the studio',
      (await page.locator('.name-chip').innerText()).trim() === 'Pug'));

    // --- Out of the cart, then delete works ---
    const cart = await (await page.request.get(`${API}/cart`, auth)).json();
    await page.request.delete(`${API}/cart/items/${cart.items[0].id}`, auth);
    await page.goto(`${WEB}/designs`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`.card[data-design="${ready._id}"]`, { timeout: 20000 });
    await page.locator(`.card[data-design="${ready._id}"] .delete-button`).click();
    await page.locator(`.card[data-design="${ready._id}"] .danger-button`).click();
    await page.waitForFunction((id) => !document.querySelector(`.card[data-design="${id}"]`), ready._id, { timeout: 15000 });
    res.push(check('Once out of the cart the design can be deleted', true));

    await page.request.delete(`${API}/designs/${draft._id}`, auth);
    await page.goto(`${WEB}/designs`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.tw-empty', { timeout: 20000 });
    res.push(check('With no designs left the page invites to start one',
      (await page.locator('.tw-empty a[href="/studio"]').count()) === 1));

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
  console.error('Test error:', e.message.slice(0, 300));
  process.exit(1);
});
