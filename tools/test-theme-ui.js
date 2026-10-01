/**
 * Browser test of the appearance switch in the top bar.
 *
 * The stylesheet has carried a dark set of tokens for a while, but nothing
 * turned it on, so the reader was stuck with whatever the operating system
 * said. This walks the two settings and proves the page really repaints,
 * rather than only that the attribute changed.
 *
 * Run: node tools/test-theme-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `theme.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
  });

  await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Kiem thu giao dien' },
  });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', EMAIL);
  await page.fill('input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 30000 });

  const button = page.locator('pm-theme-toggle button');
  const attribute = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const background = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const label = () => button.getAttribute('aria-label');

  ok('Nut co trong thanh tren', (await button.count()) === 1);

  ok('Lan dau theo cai dat he dieu hanh', (await attribute()) === 'light', String(await attribute()));
  const lightBackground = await background();
  console.log(`         nhan: ${await label()}   nen: ${lightBackground}`);
  await page.screenshot({ path: path.join(OUT, 'theme-light.png') });

  await button.click();
  await page.waitForTimeout(400);
  ok('Bam mot lan chuyen sang toi', (await attribute()) === 'dark', String(await attribute()));
  const darkBackground = await background();
  console.log(`         nhan: ${await label()}   nen: ${darkBackground}`);
  ok('Nen thuc su doi mau', lightBackground !== darkBackground,
    `${lightBackground} -> ${darkBackground}`);
  await page.screenshot({ path: path.join(OUT, 'theme-dark.png') });

  await button.click();
  await page.waitForTimeout(400);
  ok('Bam lan nua quay lai sang', (await attribute()) === 'light', String(await attribute()));
  ok('Quay lai dung mau nen ban dau', (await background()) === lightBackground);

  await button.click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  ok('Nho lua chon sau khi tai lai trang', (await attribute()) === 'dark', String(await attribute()));

  // Nguoi dung de he dieu hanh o che do toi thi lan dau vao phai la toi.
  const fresh = await browser.newContext({ colorScheme: 'dark' });
  const other = await fresh.newPage();
  await other.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await other.waitForTimeout(600);
  const firstVisit = await other.evaluate(() =>
    document.documentElement.getAttribute('data-theme'));
  ok('May dang de che do toi thi lan dau vao cung toi', firstVisit === 'dark', String(firstVisit));

  await browser.close();
  console.log('');
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})();
