const { passPhotoStep, samplePhoto } = require('./lib/made-to-order');
/**
 * Kiem thu nut them vao gio o studio (SOW muc 7, 12).
 *
 * Nut luon bam duoc. Con thieu dieu kien thi man hinh liet ke ly do, moi ly
 * do kem nut dua ve dung buoc can sua, va danh sach tu cap nhat khi khach sua.
 * Ban thiet ke chua luu thi bam them vao gio se tu luu roi them.
 * Run: node tools/test-cart-blockers-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `gio.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const ADD = '#studio-add-cart';
const BLOCK = '#studio-cart-block';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function upload(api, auth, petId, seed) {
  const sent = await api.post(`${API}/pet-photos/${petId}`, {
    headers: auth, multipart: { file: { name: `anh-${seed}.jpg`, mimeType: 'image/jpeg', buffer: await samplePhoto(seed) } },
  });
  if (!sent.ok()) {
    throw new Error(`tai anh that bai ${sent.status()}`);
  }
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('ADD TO CART BLOCKERS TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Gio hang test' } })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Na', kind: 'DOG' } })).json();
    await upload(api, auth, pet._id, 1);

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await passPhotoStep(page, pet._id);

    // --- Chua chon san pham: van bam duoc, va bao ly do ---
    await page.locator('[data-step="FINISH"]').click();
    res.push(check('The add to cart button is clickable before anything is ready', !(await page.locator(ADD).isDisabled())));
    await page.locator(ADD).click();
    await page.waitForSelector(BLOCK, { timeout: 10000 });
    res.push(check('Clicking explains that no product is chosen', (await page.locator(BLOCK).innerText()).includes('Chưa chọn sản phẩm')));

    // --- Chon san pham va kich co: ly do doi sang thieu anh ---
    await page.locator('.product:has-text("Tượng len chọc")').click();
    await page.locator('.chip:has-text("Vừa")').click();
    await page.waitForFunction((sel) => document.querySelector(sel)?.textContent?.includes('ảnh'), BLOCK, { timeout: 15000 });
    const photosLine = (await page.locator(BLOCK).innerText()).replace(/\s+/g, ' ');
    res.push(check('The list updates by itself once the product is chosen', !photosLine.includes('Chưa chọn sản phẩm'), photosLine.slice(0, 90)));
    res.push(check('It says how many photos the pet has and needs', photosLine.includes('Bé mới có 1 ảnh'), photosLine.slice(0, 90)));
    await page.screenshot({ path: path.join(OUT, 'cart-blockers.png') });

    await page.locator(`${BLOCK} .cart-block-fix[data-fix="PHOTOS"]`).click();
    res.push(check('Fix it takes the customer to the photo step',
      (await page.locator('[data-step="PHOTOS"]').getAttribute('aria-selected')) === 'true'));

    // --- Bo sung du anh roi quay lai: tu luu va them vao gio ---
    for (const seed of [2, 3, 4]) {
      await upload(api, auth, pet._id, seed);
    }
    await page.selectOption('#studio-pet', '');
    await page.selectOption('#studio-pet', pet._id);
    await page.waitForTimeout(1500);
    await page.locator('[data-step="FINISH"]').click();
    await page.locator(ADD).click();
    await page.waitForSelector('a:has-text("Xem giỏ hàng")', { timeout: 40000 });
    const cart = await (await api.get(`${API}/cart`, { headers: auth })).json();
    res.push(check('With everything ready the design is saved and added in one click', (cart.items ?? []).length === 1,
      String((cart.items ?? []).length)));
    res.push(check('The reasons disappear once nothing is missing', (await page.locator(BLOCK).count()) === 0));

    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
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
  console.error('Test error:', e.message);
  process.exit(1);
});
