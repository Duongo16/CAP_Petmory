/**
 * Full browser test of the customiser flow: painting, capturing the six angles,
 * choosing a product and size, showing the real price, engraving, saving a draft,
 * reopening the draft and adding it to the cart.
 * Run: node tools/test-studio-full-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');

/** Dau xuong dong, viet bang ma ky tu de khong bi bien dang khi sinh tep. */
const SPLIT_LINES = new RegExp(String.fromCharCode(10), 'g');
const TEMP = path.join(OUT, 'temp');
const EMAIL = `sd.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const WEBHOOK_KEY = 'change-this-key-before-running';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/**
 * Captures just the three-dimensional frame at one fixed angle.
 * Auto-rotate has to be off first, otherwise two captures differ because the model turns.
 */
async function captureFrame3d(page, file) {
        // Choosing an angle other than the current one raises a change event, and that event
        // both moves the camera and stops auto-rotate. Choosing the current angle again does not.
  await page.locator('.angle:has-text("Trước")').click();
  await page.waitForTimeout(900);
  await page.locator('canvas').first().screenshot({ path: file });
}

/** Measures the average per-pixel difference between two images of the same size. */
async function measureDifference(fileA, fileB) {
  const [a, b] = await Promise.all([
    sharp(fileA).greyscale().raw().toBuffer({ resolveWithObject: true }),
    sharp(fileB).greyscale().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.data.length !== b.data.length) {
    return 255;
  }
  let total = 0;
  for (let i = 0; i < a.data.length; i += 1) {
    total += Math.abs(a.data[i] - b.data[i]);
  }
  return Math.round((total / a.data.length) * 100) / 100;
}

/** Drags the mouse across the three-dimensional frame to paint colour onto the model. */
async function paintWoolModel(page, difference = 0) {
  const frame = await page.locator('.canvas-3d, canvas').first().boundingBox();
  const x = frame.x + frame.width / 2 + difference;
  const y = frame.y + frame.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 6, y + 6, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

async function run() {
  fs.mkdirSync(TEMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('FULL CUSTOMISER FLOW TEST');
    console.log('='.repeat(66));

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Studio test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });

    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.drawer .tab', { timeout: 40000 });
    res.push(check('The customiser screen opens', (await page.locator('.drawer .tab').count()) === 4));

                // --- Painting, in step two ---
    await page.locator('.drawer .tab').nth(1).click();
    await page.waitForSelector('.yarn-ball', { timeout: 20000 });
    await page.locator('.yarn-ball').first().click();
    await paintWoolModel(page);
    await paintWoolModel(page, 30);

                // --- Capture the six angles ---
    await page.locator('.round-button.camera').click();
    await page.locator('.drawer .tab').nth(3).click();
    await page.waitForSelector('.photo', { timeout: 30000 });
    res.push(check('All six preview angles are captured',
      (await page.locator('.photo').count()) === 6,
      `${await page.locator('.photo').count()} photo`));

                // --- Step four: choose a product and a size ---
    await page.waitForSelector('.product', { timeout: 20000 });
    const countKind = await page.locator('.product').count();
    res.push(check('Step three lists the product types', countKind >= 5, `${countKind} kind`));

    const summary = (await page.locator('.summary').innerText()).trim();
    res.push(check('The summary counts the colours used', summary.startsWith('1 '), summary));
    res.push(check('The summary reports all six angles', summary.includes('6/6'), summary));

    await page.locator('.product:has-text("Tượng len chọc")').click();
    await page.waitForTimeout(500);
    res.push(check('Choosing a type shows its sizes',
      (await page.locator('.chip:has-text("Vừa")').count()) === 1));

    res.push(check('With no size chosen there is no price',
      (await page.locator('.quote-price').count()) === 0));

    await page.locator('.chip:has-text("Vừa")').click();
    await page.waitForSelector('.quote-price', { timeout: 20000 });
    const price = (await page.locator('.quote-price').innerText()).trim();
    res.push(check('The price comes from the server', price.includes('750.000'), price));

                // --- Stand and engraving, in their own tab ---
    await page.locator('.drawer .tab').nth(2).click();
    await page.locator('.base[data-base="BASE-ROUND"]').click();
    await page.locator('.tone').nth(1).click();
    await page.locator('.decor[data-decor="FLOWERS"]').click();
    await page.locator('.decor[data-decor="BONE"]').click();
    await page.fill('input[formcontrolname="name"]', 'Ban thiet ke cua Mun');
    await page.fill('input[formcontrolname="engravedName"]', 'Mun');
    await page.fill('input[formcontrolname="memorialDate"]', '2019-05-20');
    await page.fill('textarea[formcontrolname="message"]', 'Nho be nhieu lam');
    await page.locator('.drawer .tab').nth(3).click();
    await page.waitForSelector('.quote-price', { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, 'studio-full-1-final-step.png') });

                // Capture this same angle again, to compare against the reopened draft later
    const photoBeforeWhenSave = path.join(TEMP, 'before-save.png');
    await captureFrame3d(page, photoBeforeWhenSave);

                // --- Nothing can be added to the cart before the draft is saved ---
    res.push(check('Without saving, add to cart is disabled',
      await page.locator('button:has-text("Thêm vào giỏ hàng")').isDisabled()));

                // --- Save a draft ---
    await page.locator('button:has-text("Lưu bản thiết kế")').click();
    await page.waitForSelector('.note.ok', { timeout: 40000 });
    res.push(check('The design can be saved', true));

    const designsRes = await page.request.get(`${API}/designs`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('petmory.access'))}` },
    });
    const designs = designsRes.ok() ? await designsRes.json() : [];
    // Danh sach bo phan mau to cho nhe, nen doc ban day du qua trang chi tiet.
    const first = Array.isArray(designs) ? designs[0] : null;
    const detailRes = first ? await page.request.get(`${API}/designs/${first._id}`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('petmory.access'))}` },
    }) : null;
    const design = detailRes?.ok() ? await detailRes.json() : null;
    res.push(check('The server stores the design name', design?.name === 'Ban thiet ke cua Mun', design?.name));
    res.push(check('The server stores all six preview angles', design?.preview?.length === 6,
      `${design?.preview?.length} photo`));
    res.push(check('The server stores the painted colours', (design?.paint?.length ?? 0) >= 1,
      `${design?.paint?.length} mesh`));
    res.push(check('The server stores the colour codes used', (design?.colorCodesUsed?.length ?? 0) === 1,
      (design?.colorCodesUsed ?? []).join(',')));
    res.push(check('The server stores the engraving', design?.engraving?.name === 'Mun'));
    res.push(check('The server stores the engraving font', design?.engraving?.message === 'Nho be nhieu lam'));
    res.push(check('The server stores the stand', design?.stand?.baseCode === 'BASE-ROUND'
      && design?.stand?.tone === 'WALNUT' && design?.stand?.decorations?.join(',') === 'FLOWERS,BONE',
      JSON.stringify(design?.stand)));

                // --- Add to cart ---
    await page.locator('button:has-text("Thêm vào giỏ hàng")').click();
    await page.waitForSelector('a:has-text("Xem giỏ hàng")', { timeout: 20000 });
    res.push(check('The design can be added to the cart', true));
    res.push(check('The cart badge goes up',
      (await page.locator('a[href="/cart"] [role="status"]').first().innerText()) === '1'));
    await page.screenshot({ path: path.join(OUT, 'studio-full-2-saved.png') });

                // --- Reopen the draft ---
    await page.goto(`${WEB}/studio?draft=${design._id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.drawer .tab', { timeout: 40000 });
    await page.waitForTimeout(1500);
    await page.locator('.drawer .tab').nth(2).click();
    await page.waitForSelector('input[formcontrolname="name"]', { timeout: 30000 });
    res.push(check('Reopening the draft keeps the name',
      (await page.locator('input[formcontrolname="name"]').inputValue()) === 'Ban thiet ke cua Mun'));
    res.push(check('Reopening the draft keeps the engraving',
      (await page.locator('input[formcontrolname="engravedName"]').inputValue()) === 'Mun'));
    res.push(check('Reopening the draft keeps the memorial date',
      (await page.locator('input[formcontrolname="memorialDate"]').inputValue()) === '2019-05-20'));
    await page.locator('.drawer .tab').nth(3).click();
    await page.waitForSelector('.quote-price', { timeout: 30000 });
    // Mo ngan cuoi thi tu chup sau goc, cho chup xong de camera dung yen.
    await page.waitForSelector('.photo', { timeout: 30000 });
    await page.waitForTimeout(800);
    res.push(check('Reopening the draft keeps the size and the price',
      (await page.locator('.quote-price').innerText()).includes('750.000')));
    await page.screenshot({ path: path.join(OUT, 'studio-full-3-reopened.png') });

                // The most important check: reopening must give back exactly the colours that were painted
    const imageAfterReopen = path.join(TEMP, 'after-reopen.png');
    await captureFrame3d(page, imageAfterReopen);
    const difference = await measureDifference(photoBeforeWhenSave, imageAfterReopen);
    res.push(check('Reopening the draft gives back the painted colours', difference < 3,
      `average difference ${difference} on a scale of 255`));

                // --- The cart carries the design with it ---
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.line-list .line', { timeout: 20000 });
    res.push(check('The cart holds exactly one item',
      (await page.locator('.line-list .line').count()) === 1));

                // --- Place the order, then view the production file from the internal side ---
    await page.locator('a:has-text("Tiến hành đặt hàng")').click();
    await page.waitForURL('**/checkout**', { timeout: 20000 });
    await page.fill('input[formcontrolname="fullName"]', 'Studio test');
    await page.fill('input[formcontrolname="phone"]', '0909090909');
    await page.fill('input[formcontrolname="address"]', '7 Duong Studio');
    await page.fill('input[formcontrolname="province"]', 'Da Lat');
    await page.locator('button:has-text("Xác nhận và thanh toán")').click();
    await page.waitForURL('**/payments/**', { timeout: 20000 });
    const orderCode = page.url().split('/').pop();
    res.push(check('The order is created from the saved design', Boolean(orderCode), orderCode));

    // So tien chuyen khoan lay dung tong don tu may chu, vi gia de da cong vao.
    const orderRes = await page.request.get(`${API}/orders/${orderCode}`, {
      headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('petmory.access'))}` },
    });
    const orderBody = orderRes.ok() ? await orderRes.json() : {};
    const orderTotal = String(orderBody.total?.$numberDecimal ?? orderBody.total ?? '0').split('.')[0];
    res.push(check('The order total includes the stand price', orderTotal === '870000', orderTotal));

    await page.request.post(`${API}/payments/webhook`, {
      headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
      data: { id: `sd-${Date.now()}`, transferAmount: Number(orderTotal), content: `CT DEN ${orderCode}` },
    });

    // Switch to an operations account to open the production file
    // Xoa phien dang nhap roi mo trang dang nhap, khong phu thuoc vao vi tri nut dang xuat.
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', 'quanly@petmory.local');
    await page.fill('input[formcontrolname="password"]', 'Petmory@2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 20000 });

    await page.goto(`${WEB}/admin/orders/${orderCode}/production-file`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.wool-list li', { timeout: 30000 });
    res.push(check('The production file names the wool rolls needed',
      (await page.locator('.wool-list li').count()) === 1,
      (await page.locator('.wool-list li').first().innerText()).trim()));
    /*
     * Tim dung the chua danh sach len thay vi dem theo thu tu the tren trang.
     * Dem theo thu tu la cach bai kiem thu nay tung lam, va no hong ngay khi
     * trang them mot the moi.
     */
    const cardItem = page.locator('.card:has(.wool-list)').first();
    const wordItem = (await cardItem.innerText()).trim();
    res.push(check('The production file carries the engraving',
      wordItem.includes('Nho be nhieu lam'), wordItem.slice(0, 90).replace(SPLIT_LINES, ' / ')));

    await page.waitForSelector('.photo-grid img', { timeout: 30000 });
    res.push(check('The production file shows the six angles the customer approved',
      (await page.locator('.photo-grid img').count()) === 6,
      `${await page.locator('.photo-grid img').count()} photo`));
    const standText = (await page.locator('.stand-line').first().innerText()).trim();
    res.push(check('The production file names the stand and its wood', standText.includes('Gỗ tròn')
      && standText.includes('óc chó'), standText));
    res.push(check('The production file lists the stand decorations',
      (await page.locator('.stand-decor .tw-badge').count()) === 2));
    res.push(check('Nothing is reported missing',
      (await page.locator('.missing-warning').count()) === 0));
    await page.screenshot({ path: path.join(OUT, 'studio-full-4-production-file.png'), fullPage: true });

    const realErrors = error.filter((l) => !/favicon/i.test(l));
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
    fs.rmSync(TEMP, { recursive: true, force: true });
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
