/**
 * Kiem thu han muc phuc hoi anh moi ngay (SOW muc 4, 14).
 *
 * Quan ly dat so luot toi da mot ngay o trang tham so. Khach thay con bao nhieu
 * luot, dung het thi may chu tu choi va nut phuc hoi bi khoa. Han muc tinh rieng
 * cho tung tai khoan. Bai kiem tam ha han muc xuong hai luot roi tra lai nhu cu.
 * Run: node tools/test-restore-quota-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { samplePhoto } = require('./lib/made-to-order');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const PASSWORD = 'Password@123';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');
const CAP = 2;

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function customer(api, tag) {
  const made = await (await api.post(`${API}/auth/register`, {
    data: { email: `quota.${tag}.${Date.now()}@petmory.local`, password: PASSWORD, fullName: 'Han muc test' },
  })).json();
  return { email: made.user.email, auth: { Authorization: `Bearer ${made.accessToken}` } };
}

async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-quota-'));
  const file = path.join(tmp, 'be.jpg');
  fs.writeFileSync(file, await samplePhoto(5));
  const photo = { name: 'be.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(file) };
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  let manager = null;
  let before = null;
  try {
    console.log('DAILY PHOTO RESTORE QUOTA TEST');
    console.log('='.repeat(64));
    const login = await (await api.post(`${API}/auth/login`, { data: MANAGER })).json();
    manager = { Authorization: `Bearer ${login.accessToken}` };
    before = (await (await api.get(`${API}/settings`, { headers: manager })).json()).aiQuota.restorePhoto;
    const set = await api.patch(`${API}/settings`, {
      headers: manager, data: { aiQuota: { restorePhoto: { day: CAP, month: 0, year: 0 } } },
    });
    res.push(check('The manager sets the number of restores per day', set.ok(), String(set.status())));

    const one = await customer(api, 'a');
    const fresh = await (await api.get(`${API}/photo-restore/quota`, { headers: one.auth })).json();
    res.push(check('A new customer has the full day of restores', fresh.day === CAP && fresh.left === CAP, JSON.stringify(fresh)));

    // Giao dien bao so luot con lai truoc khi khach bam.
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', one.email);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/restore`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#restore-file', file);
    await page.waitForSelector('#restore-quota', { timeout: 15000 });
    const line = (await page.locator('#restore-quota').innerText()).trim();
    res.push(check('The restore screen shows the turns left', line.includes(`Còn ${CAP}`) && line.includes(`${CAP} lượt mỗi ngày`), line));

    await page.click('#restore-run');
    await page.waitForSelector('#restore-mode', { timeout: 60000 });
    await page.waitForFunction(
      (want) => document.querySelector('#restore-quota')?.textContent?.includes(want) ?? false,
      `Còn ${CAP - 1}`,
      { timeout: 15000 },
    ).catch(() => undefined);
    const afterOne = (await page.locator('#restore-quota').innerText()).trim();
    res.push(check('Each restore takes one turn off the count', afterOne.includes(`Còn ${CAP - 1}`), afterOne));

    // Dung not luot cuoi qua may chu, roi luot tiep theo phai bi tu choi.
    const last = await api.post(`${API}/photo-restore`, { headers: one.auth, multipart: { operation: 'SHARPEN', file: photo } });
    res.push(check('The last turn of the day still works', last.status() === 201, String(last.status())));
    const over = await api.post(`${API}/photo-restore`, { headers: one.auth, multipart: { operation: 'SHARPEN', file: photo } });
    res.push(check('Going over the daily limit is refused', over.status() === 429, String(over.status())));

    await page.reload({ waitUntil: 'networkidle' });
    await page.setInputFiles('#restore-file', file);
    await page.waitForSelector('#restore-quota.out', { timeout: 15000 });
    res.push(check('With no turns left the screen says so', (await page.locator('#restore-quota').innerText()).includes('Còn 0')));
    res.push(check('With no turns left the restore button is locked', await page.locator('#restore-run').isDisabled()));
    await page.screenshot({ path: path.join(OUT, 'restore-quota.png') });

    const two = await customer(api, 'b');
    const other = await (await api.get(`${API}/photo-restore/quota`, { headers: two.auth })).json();
    res.push(check('The limit is counted per account', other.left === CAP, JSON.stringify(other)));

    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
  } finally {
    // Tra han muc ve nhu truoc de cac bai kiem khac khong bi anh huong.
    if (manager && before) {
      await api.patch(`${API}/settings`, { headers: manager, data: { aiQuota: { restorePhoto: before } } });
    }
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
  console.error('Test error:', e.message);
  process.exit(1);
});
