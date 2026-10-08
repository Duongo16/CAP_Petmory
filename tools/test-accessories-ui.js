const { petWithPhotos, passPhotoStep, waitOverlayGone } = require('./lib/made-to-order');
/**
 * Kiem thu phu kien tu dau den cuoi (SOW muc 5, 6, 12): khach gan va thao phu kien
 * tren mau nen, moi diem neo mot mon, gioi han theo kich co, gia cong vao bao gia,
 * luu cung ban thiet ke, va gio hang chot ten cung gia. May chu chan cac truong hop sai.
 * Run: node tools/test-accessories-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `acc.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');

/**
 * Bam sau khi lop phu dang tai bien mat. Moi lan doi phu kien studio goi may chu
 * va lop phu che man hinh, bam ngay luc do thi cu bam roi vao lop phu.
 */
async function tap(page, selector) {
  await waitOverlayGone(page);
  await page.locator(selector).click();
}

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

const digits = (text) => Number(String(text).replace(/\D/g, ''));

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('ACCESSORIES END TO END TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Phu kien test' },
    })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const petId = await petWithPhotos(made.accessToken, 4, 'Be phu kien');
    const catalog = await (await api.get(`${API}/catalog/accessories`)).json();
    const price = Object.fromEntries(catalog.map((one) => [one.code, digits(one.priceDelta.$numberDecimal ?? one.priceDelta)]));
    res.push(check('The shop lists six accessories', catalog.length === 6, String(catalog.length)));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#studio-match-box', { timeout: 40000 });
    res.push(check('The studio opens on the model step with the accessory step open',
      (await page.locator('[data-step="MODEL"]').getAttribute('aria-selected')) === 'true'
        && !(await page.locator('[data-step="STAND"]').isDisabled())));
    // Dung mau tu anh cua be o buoc chon mau, roi chon mau cun ngoi de gan phu kien.
    await passPhotoStep(page, petId);
    await page.waitForSelector('.model[data-model]', { timeout: 40000 });
    await tap(page, '.model[data-model="BASE-DOG-SIT"]');
    await page.waitForTimeout(2500);

    // Chon san pham va kich co truoc de biet gioi han phu kien.
    await tap(page, '[data-step="FINISH"]');
    await tap(page, '.product:has-text("Tượng len chọc")');
    await tap(page, '.chip:has-text("Vừa")');
    await page.waitForSelector('.quote-price', { timeout: 20000 });
    const plain = digits(await page.locator('.quote-price').innerText());

    await tap(page, '[data-step="STAND"]');
    await page.waitForSelector('.accessory', { timeout: 10000 });
    res.push(check('The stand step lists the accessories', (await page.locator('.accessory').count()) === 6));
    await tap(page, '.accessory[data-accessory="ACC-KNIT-HAT"]');
    await tap(page, '.accessory[data-accessory="ACC-BOW"]');
    res.push(check('A second accessory on the same anchor replaces the first',
      (await page.locator('.accessory[data-accessory="ACC-KNIT-HAT"]').getAttribute('aria-pressed')) === 'false'
      && (await page.locator('.accessory[data-accessory="ACC-BOW"]').getAttribute('aria-pressed')) === 'true'));
    await tap(page, '.accessory[data-accessory="ACC-COLLAR-TAG"]');
    await tap(page, '.accessory[data-accessory="ACC-GLASSES"]');
    const counter = (await page.locator('.group-title .count').first().innerText()).trim();
    const max = Number(counter.split('/')[1]);
    if (max <= 3) {
      await tap(page, '.accessory[data-accessory="ACC-CAPE"]');
      res.push(check('Going over the size limit is refused with a note',
        (await page.locator('.acc-note').count()) === 1
        && (await page.locator('.accessory[data-accessory="ACC-CAPE"]').getAttribute('aria-pressed')) === 'false', counter));
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'accessories-studio.png') });

    await page.fill('input[formcontrolname="name"]', 'Cun ngoi co phu kien');
    // Be da chon o khung dung mau, sang buoc anh chi de chac be van du anh.
    await tap(page, '[data-step="PHOTOS"]');
    await page.waitForSelector('#studio-photo-need.ok', { timeout: 20000 });
    res.push(check('The pet chosen in the model step is kept', (await page.locator('#studio-pet').inputValue()) === petId));
    await tap(page, '[data-step="FINISH"]');
    const expected = plain + price['ACC-BOW'] + price['ACC-COLLAR-TAG'] + price['ACC-GLASSES'];
    await page.waitForFunction((want) => Number((document.querySelector('.quote-price')?.textContent ?? '').replace(/\D/g, '')) === want,
      expected, { timeout: 15000 }).catch(() => undefined);
    const shown = digits(await page.locator('.quote-price').innerText());
    res.push(check('The quote adds the accessory prices on the server', shown === expected, `${shown} vs ${expected}`));
    res.push(check('The price line names the accessories',
      (await page.locator('.acc-line').innerText()).includes('Nơ cài đầu')));

    await tap(page, 'button:has-text("Lưu bản thiết kế")');
    await page.waitForSelector('.note.ok', { timeout: 40000 });
    const list = await (await api.get(`${API}/designs`, { headers: auth })).json();
    const design = await (await api.get(`${API}/designs/${list[0]._id}`, { headers: auth })).json();
    res.push(check('The design stores the accessories',
      (design.accessories ?? []).join(',') === 'ACC-BOW,ACC-COLLAR-TAG,ACC-GLASSES', (design.accessories ?? []).join(',')));

    await tap(page, 'button:has-text("Thêm vào giỏ hàng")');
    await page.waitForSelector('a:has-text("Xem giỏ hàng")', { timeout: 20000 });
    const cart = await (await api.get(`${API}/cart`, { headers: auth })).json();
    const line = cart.items[0];
    res.push(check('The cart line freezes the accessories', (line?.accessories ?? []).length === 3));
    res.push(check('The cart line price includes the accessories', digits(line?.unitPrice) === expected, line?.unitPrice));
    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.acc-chip', { timeout: 15000 });
    res.push(check('The cart page shows the accessories', (await page.locator('.acc-chip').count()) === 3));

    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await passPhotoStep(page, petId);
    await page.waitForSelector('.model[data-model]', { timeout: 40000 });
    await tap(page, '.model[data-model="Q-SHIBA"]');
    await page.waitForTimeout(1500);
    await tap(page, '[data-step="STAND"]');
    await page.waitForSelector('.acc-hint', { timeout: 10000 }).catch(() => undefined);
    res.push(check('A model without anchors explains it cannot take accessories',
      (await page.locator('.acc-hint').count()) === 1 && (await page.locator('.accessory').count()) === 0));

    const twice = await api.post(`${API}/designs`, {
      headers: auth,
      data: { name: 'Hai mon mot cho', modelCode: 'BASE-DOG-SIT', accessories: ['ACC-KNIT-HAT', 'ACC-BOW'] },
    });
    res.push(check('The server refuses two accessories on one anchor', twice.status() === 400, String(twice.status())));
    const noAnchor = await api.post(`${API}/designs`, {
      headers: auth,
      data: { name: 'Mau khong neo', modelCode: 'Q-SHIBA', accessories: ['ACC-BOW'] },
    });
    res.push(check('The server refuses accessories on a model without anchors', noAnchor.status() === 400, String(noAnchor.status())));
    const unknown = await api.get(`${API}/designs/quote?productTypeCode=${design.productTypeCode}&sizeCode=${design.sizeCode}&accessories=KHONG-CO`, { headers: auth });
    res.push(check('The quote refuses an unknown accessory', unknown.status() === 400, String(unknown.status())));
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
