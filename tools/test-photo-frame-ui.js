/**
 * Kiem thu khung nap anh theo goc (SOW muc 3): chi goc chinh dien la bat buoc,
 * nam goc con lai tuy chon, nap bang nut chon hoac keo tha, xem truoc, thay anh, bo anh, cham diem
 * chat luong va canh bao khi anh khong dat.
 * Run: node tools/test-photo-frame-ui.js
 */
const { chromium, request } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `khung.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Anh co hoa tiet de du net; kich thuoc quyet dinh diem chat luong. */
async function photo(width, height, seed) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * (31 + seed) + (i >> 6) * 7) % 255;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

/** Mo hop sua anh vua hien ra va giu nguyen anh. */
async function keepInDialog(page) {
  await page.waitForSelector('.pm-dialog button.strong', { timeout: 15000 });
  await page.locator('.pm-dialog button:has-text("Giữ ảnh gốc")').first().click().catch(async () => {
    await page.locator('.pm-dialog button.strong').first().click();
  });
  await page.waitForSelector('.pm-dialog', { state: 'detached', timeout: 15000 });
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-frame-'));
  const good = path.join(tmp, 'truoc.jpg');
  const better = path.join(tmp, 'truoc-moi.jpg');
  const small = path.join(tmp, 'nho.jpg');
  fs.writeFileSync(good, await photo(1400, 1100, 1));
  fs.writeFileSync(better, await photo(1500, 1200, 2));
  fs.writeFileSync(small, await photo(260, 200, 3));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('PHOTO FRAME TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Khung anh test' } })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Mit' } })).json();
    const list = async () => (await (await api.get(`${API}/pet-photos?pet=${pet._id}`, { headers: auth })).json()).filter((one) => !one.isRestored);

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/pets/${pet._id}/journal?view=photos`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.slots .slot', { timeout: 20000 });
    res.push(check('The frame shows one required and five optional angles',
      (await page.locator('.slot').count()) === 6 && (await page.locator('.slot .slot-optional').count()) === 5));
    res.push(check('Only the front angle is required',
      (await page.locator('.slot[data-angle="FRONT"] .slot-optional').count()) === 0));
    res.push(check('The counter starts at zero of one required angle', (await page.locator('.frame-count').innerText()).startsWith('0/1')));
    res.push(check('The missing front photo is pointed out', (await page.locator('.frame-warn').count()) === 1));

    await page.setInputFiles('#slot-FRONT', good);
    await keepInDialog(page);
    await page.waitForSelector('.slot[data-angle="FRONT"].filled img', { timeout: 20000 });
    res.push(check('Choosing a file fills the front angle with a preview', true));
    res.push(check('The quality score is shown on the angle', (await page.locator('.slot[data-angle="FRONT"] .quality').count()) === 1,
      await page.locator('.slot[data-angle="FRONT"] .quality').innerText().catch(() => '')));
    const first = (await list()).find((one) => one.angle === 'FRONT');

    // Keo tha mot anh vao goc ben trai.
    const bytes = fs.readFileSync(good).toString('base64');
    const transfer = await page.evaluateHandle((data) => {
      const raw = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([raw], 'trai.jpg', { type: 'image/jpeg' }));
      return dt;
    }, bytes);
    await page.dispatchEvent('.slot[data-angle="LEFT_SIDE"]', 'dragover', { dataTransfer: transfer });
    await page.dispatchEvent('.slot[data-angle="LEFT_SIDE"]', 'drop', { dataTransfer: transfer });
    await keepInDialog(page);
    await page.waitForSelector('.slot[data-angle="LEFT_SIDE"].filled img', { timeout: 20000 });
    res.push(check('Dropping a file onto an angle fills it', true));
    res.push(check('The counter counts only required angles', (await page.locator('.frame-count').innerText()).startsWith('1/1'),
      await page.locator('.frame-count').innerText()));
    res.push(check('The warning is gone once the front photo is in', (await page.locator('.frame-warn').count()) === 0));

    await page.setInputFiles('#slot-FRONT', better);
    await keepInDialog(page);
    let fronts = [];
    for (let i = 0; i < 30; i += 1) {
      fronts = (await list()).filter((one) => one.angle === 'FRONT');
      if (fronts.length === 1 && fronts[0]._id !== first?._id) {
        break;
      }
      await page.waitForTimeout(500);
    }
    res.push(check('Replacing keeps exactly one photo on the angle, the new one',
      fronts.length === 1 && fronts[0]._id !== first?._id, `${fronts.length}`));

    await page.setInputFiles('#slot-BACK', small);
    await keepInDialog(page);
    await page.waitForSelector('.slot[data-angle="BACK"].filled .quality', { timeout: 20000 });
    res.push(check('A photo that falls short is flagged with a warning',
      (await page.locator('.slot[data-angle="BACK"] .quality.warn').count()) === 1,
      await page.locator('.slot[data-angle="BACK"] .quality').innerText()));
    res.push(check('A weak optional photo does not bring back the missing warning', (await page.locator('.frame-warn').count()) === 0));
    await page.screenshot({ path: path.join(OUT, 'photo-frame.png'), fullPage: true });

    await page.locator('.slot[data-angle="BACK"] .slot-remove').click();
    await page.waitForSelector('.slot[data-angle="BACK"]:not(.filled)', { timeout: 15000 });
    res.push(check('Removing empties the angle again', !(await list()).some((one) => one.angle === 'BACK')));

    const wrong = path.join(tmp, 'clip.mp4');
    fs.writeFileSync(wrong, Buffer.from('not a video really'));
    await page.setInputFiles('#slot-RIGHT_SIDE', wrong);
    await page.waitForTimeout(800);
    res.push(check('A non-image file is not accepted',
      !(await list()).some((one) => one.angle === 'RIGHT_SIDE')));
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
