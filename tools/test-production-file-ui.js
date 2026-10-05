/**
 * Kiem thu ho so san xuat day du (SOW muc 11): anh tham chieu hien thanh anh,
 * mo hinh 3D do duoc kich thuoc, bang thong so kich co, phu kien, dac diem
 * rieng cua be, phieu kiem tra chat luong, va in duoc. Du lieu dung: mot khach
 * moi, mot be, mot anh, mot ban thiet ke co phu kien, mot don.
 * Run: node tools/test-production-file-ui.js
 */
const { chromium, request } = require('playwright');
const sharp = require('sharp');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');
const NOTE = 'Dom trang o chan trai, tai phai hoi cup';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Mot tam anh du lon de qua buoc cham chat luong. */
async function samplePhoto() {
  const noise = Buffer.alloc(1200 * 900 * 3);
  for (let i = 0; i < noise.length; i += 1) {
    noise[i] = (i * 37 + (i >> 7) * 11) % 255;
  }
  return sharp(noise, { raw: { width: 1200, height: 900, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('PRODUCTION FILE TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, {
      data: { email: `xuong.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Ho so test' },
    })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Bap', breed: 'Corgi' } })).json();
    const upload = await api.post(`${API}/pet-photos/${pet._id}`, {
      headers: auth,
      multipart: { angle: 'GENERAL', file: { name: 'bap.jpg', mimeType: 'image/jpeg', buffer: await samplePhoto() } },
    });
    const photo = await upload.json();
    res.push(check('The customer photo is uploaded', upload.ok(), String(upload.status())));
    const design = await (await api.post(`${API}/designs`, {
      headers: auth,
      data: {
        name: 'Bap ngoi', modelCode: 'BASE-DOG-SIT', pet: pet._id, productTypeCode: 'PT-01', sizeCode: 'FIG-M',
        accessories: ['ACC-KNIT-HAT', 'ACC-COLLAR-TAG'], featureNote: NOTE,
        engraving: { name: 'Bap', message: 'Thuong Bap' },
      },
    })).json();
    res.push(check('The design with accessories and a feature note is saved', Boolean(design._id), design.message));
    await api.post(`${API}/cart/items`, {
      headers: auth, data: { productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1, designId: design._id, petName: 'Bap' },
    });
    const order = await (await api.post(`${API}/orders`, {
      headers: auth, data: { fullName: 'Ho So Test', phone: '0901234567', address: '1 Duong Xuong', province: 'Da Lat' },
    })).json();
    res.push(check('The order is placed', Boolean(order.orderCode), order.orderCode));

    const managerToken = (await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken;
    const manager = { Authorization: `Bearer ${managerToken}` };
    const file = await (await api.get(`${API}/admin/orders/${order.orderCode}/production-file`, { headers: manager })).json();
    const item = file.items?.[0] ?? {};
    res.push(check('The file carries the size specification', Boolean(item.sizeSpec?.dimensions), JSON.stringify(item.sizeSpec)));
    res.push(check('The file lists the accessories', (item.accessories ?? []).map((one) => one.code).join(',') === 'ACC-KNIT-HAT,ACC-COLLAR-TAG'));
    res.push(check('The file carries the feature note and the pet breed', item.featureNote === NOTE && item.pet?.breed === 'Corgi'));
    res.push(check('The file names the light and full model files', item.model?.file === 'base-dog-sitting.glb' && item.model?.fileFull === 'base-dog-sitting-full.glb'));
    const own = await api.get(`${API}/admin/orders/${order.orderCode}/photos/${photo._id}`, { headers: manager });
    res.push(check('The reference photo of the order can be read', own.status() === 200 && (await own.body()).length > 1000));
    const stranger = await api.get(`${API}/admin/orders/${order.orderCode}/photos/000000000000000000000000`, { headers: manager });
    res.push(check('A photo outside the order is refused', stranger.status() === 404, String(stranger.status())));
    const asCustomer = await api.get(`${API}/admin/orders/${order.orderCode}/photos/${photo._id}`, { headers: auth });
    res.push(check('A customer cannot open the workshop photo path', asCustomer.status() === 403, String(asCustomer.status())));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/admin/orders/${order.orderCode}/production-file`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.spec-table', { timeout: 20000 });
    res.push(check('The page shows the size table', (await page.locator('.spec-table tr').count()) === 4));
    res.push(check('The page lists the accessories', (await page.locator('.accessory-list li').count()) === 2));
    res.push(check('The page shows the feature note', (await page.locator('.feature-note').innerText()).includes('Dom trang')));
    await page.waitForSelector('.reference-grid img', { timeout: 20000 });
    res.push(check('Reference photos show as images', (await page.locator('.reference-grid img').count()) >= 1));
    res.push(check('The quality checklist is on the page', (await page.locator('.qc-list li').count()) >= 1));

    await page.waitForSelector('.model-size', { timeout: 30000 });
    const sizeText = await page.locator('.model-size').innerText();
    res.push(check('The 3D model reports its size in cm from the real height', /cao\s+\d/i.test(sizeText), sizeText));
    await page.fill('.real-height', '20');
    await page.locator('.real-height').dispatchEvent('change');
    await page.waitForFunction(() => /cao 20[.,]0 cm/i.test(document.querySelector('.model-size')?.textContent ?? ''), null, { timeout: 5000 })
      .catch(() => undefined);
    res.push(check('Changing the real height rescales the size', /cao 20[.,]0 cm/i.test(await page.locator('.model-size').innerText()),
      await page.locator('.model-size').innerText()));

    await page.click('.measure-toggle');
    const canvas = page.locator('pm-production-model-card canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await canvas.boundingBox();
    // Bam lan luot doc giua mo hinh; diem nao trung be thi duoc tinh, hai diem trung la co khoang cach.
    for (const ratio of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * ratio);
      await page.waitForTimeout(250);
      if (await page.locator('.model-distance').count()) {
        break;
      }
    }
    const distance = (await page.locator('.model-distance').count()) ? await page.locator('.model-distance').innerText() : '';
    res.push(check('Two clicks on the model measure a distance in cm', /\d+[.,]\d cm/.test(distance), distance));
    res.push(check('The full model can be downloaded', (await page.locator('.full-link').getAttribute('href')) === '/models/base-dog-sitting-full.glb'));
    await page.screenshot({ path: path.join(OUT, 'production-file.png'), fullPage: true });
    await page.emulateMedia({ media: 'print' });
    res.push(check('Print view hides the screen-only tools', !(await page.locator('.measure-toggle').isVisible())));
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
