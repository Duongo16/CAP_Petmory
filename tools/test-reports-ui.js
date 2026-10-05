/**
 * Kiem thu tren trinh duyet ba bao cao quan tri, theo Phu luc 01 muc 22.
 *
 * Kiem ca phan phan quyen: nhom Quan ly thay ca ba bao cao, nhom Cham soc
 * khach hang khong mo duoc trang bao cao nao.
 *
 * Chay: node tools/test-reports-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const PASSWORD = 'Petmory@2026';

let failed = 0;
function ok(name, good, note = '') {
  if (!good) {
    failed += 1;
  }
  console.log(`  ${good ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 60 giay');
}

async function signIn(page, email) {
  /*
   * Doi den khi trang tai xong, khong doi den khi mang im hoan toan. Trang
   * bao cao vua mo co mot dia chi tep tam dang giu, va cho mang im han o do
   * co the cho mai.
   */
  await page.goto(WEB, { waitUntil: 'load' });
  /*
   * Doi khung trang hien ra roi moi tim nut tai khoan. Doc ngay sau khi tep
   * tai xong thi ung dung chua kip dung khung, nut chua co, va buoc thoat
   * tai khoan bi bo qua mot cach im lang.
   */
  // Xoa phien dang mo ngay trong trinh duyet, khong phu thuoc nut dang xuat.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 30000 }).catch(async () => {
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 40000 });
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 1100 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('BAO CAO QUAN TRI TREN GIAO DIEN');
  console.log('='.repeat(64));

  // --- Nhom Quan ly thay ca ba bao cao ---
  await signIn(page, 'quanly@petmory.local');
  await page.goto(`${WEB}/admin/reports`, { waitUntil: 'networkidle' });
  await settle(page);
  // Trang mo san o che do bieu do, cac bang so lieu nam o nut thu hai.
  await page.locator('.toggle-btn').nth(1).click();
  await page.waitForSelector('#report-revenue', { timeout: 30000 });
  ok('Nhom Quan ly thay ca ba bao cao', (await page.locator('.card').count()) === 3,
    String(await page.locator('.card').count()));
  ok('Bao cao doanh thu co con so tong',
    (await page.locator('#report-revenue .big-number').innerText()).includes('VND'),
    (await page.locator('#report-revenue .big-number').innerText()).trim());
  ok('Doanh thu tach theo hai dong hang',
    (await page.locator('#report-revenue tbody tr').count()) >= 2,
    String(await page.locator('#report-revenue tbody tr').count()));
  ok('Bao cao chi phi AI liet ke du bon loai luot dung',
    (await page.locator('#report-ai tbody tr').count()) === 4,
    String(await page.locator('#report-ai tbody tr').count()));
  ok('Bao cao tien do liet ke du sau trang thai',
    (await page.locator('#report-progress tbody tr').count()) === 6,
    String(await page.locator('#report-progress tbody tr').count()));
  await page.screenshot({ path: path.join(OUT, 'reports-1-manager.png'), fullPage: true });

  // --- Doi khoang thoi gian ---
  const before = (await page.locator('#report-revenue .big-number').innerText()).trim();
  await page.fill('#report-from', '2020-01-01');
  await page.fill('#report-to', '2020-01-31');
  await page.locator('button:has-text("Xem báo cáo")').click();
  await page.waitForTimeout(2000);
  const after = (await page.locator('#report-revenue .big-number').innerText()).trim();
  ok('Doi khoang thoi gian thi so lieu doi theo', before !== after, `${before} -> ${after}`);
  ok('Khoang khong co du lieu thi doanh thu bang khong', after.startsWith('0'), after);

  // --- Tai tep CSV ---
  await page.fill('#report-from', '2020-01-01');
  await page.fill('#report-to', new Date().toISOString().slice(0, 10));
  await page.locator('button:has-text("Xem báo cáo")').click();
  await page.waitForTimeout(1800);
  await page.locator('#report-revenue button:has-text("Tải CSV")').click();
  await page.waitForSelector('.ready-file a', { timeout: 20000 });
  const link = await page.locator('.ready-file a').getAttribute('href');
  ok('Nut tai CSV cho ra mot lien ket tep that', (link ?? '').startsWith('blob:'),
    String(link).slice(0, 24));
  ok('Tep tai ve dung ten bao cao',
    (await page.locator('.ready-file a').getAttribute('download')) === 'revenue.csv',
    String(await page.locator('.ready-file a').getAttribute('download')));

  // --- Nhom Cham soc khach hang khong mo duoc bao cao nao ---
  await signIn(page, 'cskh@petmory.local');
  await page.goto(`${WEB}/admin/reports`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);
  ok('Nhom CSKH bi dua ra khoi trang bao cao',
    !page.url().includes('/admin/reports'), page.url());

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
