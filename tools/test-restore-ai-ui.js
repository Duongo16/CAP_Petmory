/**
 * Kiem thu phuc hoi anh co chon thao tac (SOW muc 4): khach chon cach phuc hoi,
 * gom hai thao tac AI (tang chi tiet mat, tach nen) qua dich vu anh; man hinh
 * noi ro da dung AI that hay chi bo loc; xac nhan bang cach luu vao album cua be.
 * Thao tac tach nen goi dich vu anh that mot lan.
 * Run: node tools/test-restore-ai-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { samplePhoto } = require('./lib/made-to-order');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `phuchoi.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-restore-'));
  const file = path.join(tmp, 'be.jpg');
  fs.writeFileSync(file, await samplePhoto(3));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('PHOTO RESTORE WITH CHOSEN OPERATIONS TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Phuc hoi test' } })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Lu' } })).json();

    // May chu: thao tac la bi tu choi.
    const bad = await api.post(`${API}/photo-restore`, {
      headers: auth, multipart: { operation: 'MAKE_IT_A_CAT', file: { name: 'be.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(file) } },
    });
    res.push(check('An unknown operation is refused', bad.status() === 400, String(bad.status())));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/restore`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#restore-file', file);
    await page.waitForSelector('.ops .op', { timeout: 15000 });
    res.push(check('The customer can choose among seven operations, two marked AI',
      (await page.locator('.ops .op').count()) === 7 && (await page.locator('.ops .ai-tag').count()) === 2));

    // Chi bo loc tai may: ket qua ghi ro khong dung AI.
    await page.click('#restore-run');
    await page.waitForSelector('#restore-mode', { timeout: 60000 });
    res.push(check('Filters only are reported as not using AI', (await page.locator('#restore-mode.note-ok').count()) === 0));
    await page.click('button:has-text("Chọn ảnh khác"), .actions .tw-btn-secondary:not(#restore-download)').catch(() => undefined);

    await page.goto(`${WEB}/restore`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#restore-file', file);
    await page.waitForSelector('.ops .op', { timeout: 15000 });
    for (const code of ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE']) {
      await page.click(`.op[data-op="${code}"]`);
    }
    await page.click('.op[data-op="REMOVE_BACKGROUND"]');
    await page.click('#restore-run');
    await page.waitForSelector('#restore-mode', { timeout: 120000 });
    const live = (await page.locator('#restore-mode.note-ok').count()) === 1;
    const skipped = (await page.locator('#restore-skipped').count()) === 1;
    // Dich vu anh chay duoc tren goi mien phi, nen tach nen phai chay that chu khong duoc bo qua.
    res.push(check('Background removal runs for real through the image service', live && !skipped,
      live ? 'AI that' : 'bao khong lam duoc'));
    await page.screenshot({ path: path.join(OUT, 'restore-ai.png'), fullPage: true });

    await page.click('#restore-save');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#restore-save')?.textContent ?? ''), null, { timeout: 30000 });
    const album = await (await api.get(`${API}/pet-photos?pet=${pet._id}`, { headers: auth })).json();
    res.push(check('Saving puts the restored photo into the pet album', Array.isArray(album) && album.length === 1, String(album.length)));

    const usage = await api.get(`${API}/pet-photos/restoration`, { headers: auth });
    res.push(check('The restoration page keeps working afterwards', usage.ok()));
    res.push(check('No javascript error', errors.length === 0, errors.join(' | ').slice(0, 200)));
  } finally {
    await browser.close();
    await api.dispose();
    fs.rmSync(tmp, { recursive: true, force: true });
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
