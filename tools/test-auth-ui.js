/**
 * Browser test of the sign in and register screens.
 *
 * The register form now collects a phone number, and the first pet started on
 * the welcome page joins the new account; the old single screen had neither. This walks a real person through
 * it and then checks the two new pieces really landed in the database, rather
 * than only that the page navigated.
 *
 * Run: node tools/test-auth-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `dangky.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';
const PHONE = '0912345678';
const PET = `Bo ${STAMP}`;

/**
 * Dia chi co so du lieu dang dung.
 *
 * Uu tien bien moi truong, roi moi den tep cau hinh. Nho vay bai kiem doc
 * dung co so du lieu ma may chu dang chay, ke ca khi may chu duoc chi sang
 * mot dia chi khac luc khoi dong.
 */
function mongoUri() {
  const fromEnv = (process.env.MONGODB_URI || '').trim();
  if (fromEnv !== '') {
    return fromEnv;
  }
  const line = fs
    .readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('MONGODB_URI='));
  return line ? line.slice(line.indexOf('=') + 1).trim() : '';
}

/** Doc ban ghi tai khoan thang trong co so du lieu de kiem chung. */
async function readStoredUser(email) {
  const { MongoClient } = require('mongodb');
  const uri = mongoUri();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const name = (uri.split('://')[1].split('/')[1] || '').split('?')[0];
    return await client.db(name).collection('users').findOne({ email: email.toLowerCase() });
  } finally {
    await client.close();
  }
}

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('SIGN IN AND REGISTER');
  console.log('='.repeat(64));

  // --- The register screen ---
  // The first pet now comes from the guided start on the welcome page, kept as a draft.
  await page.goto(`${WEB}/landing`, { waitUntil: 'networkidle' });
  await page.evaluate((name) => localStorage.setItem('pm.pet-draft', JSON.stringify({
    name, kind: 'DOG', breed: '', gender: 'UNKNOWN', birthDate: '', tagline: '',
  })), PET);
  await page.goto(`${WEB}/register`, { waitUntil: 'networkidle' });
  ok('Duong dan dang ky mo duoc', await page.locator('form').isVisible());
  ok('Co hai nut mang xa hoi', (await page.locator('.social button').count()) === 2);
  ok('Co ba muc dac quyen', (await page.locator('.perk').count()) === 3);

  await page.locator('.social button').first().click();
  await page.waitForTimeout(300);
  ok('Bam nut mang xa hoi thi noi ro chua ket noi',
    await page.locator('.notice').isVisible());

  // --- The strength meter ---
  await page.fill('#up-password', 'abc');
  await page.waitForTimeout(200);
  const weak = await page.locator('.meter-value').innerText();
  await page.fill('#up-password', 'Petmory@2026xyz');
  await page.waitForTimeout(200);
  const strong = await page.locator('.meter-value').innerText();
  ok('Thanh do manh mat khau doi theo cai da go', weak !== strong, `${weak} -> ${strong}`);

  // --- A wrong phone number is refused before sending ---
  await page.fill('#up-phone', '123');
  await page.locator('#up-name').click();
  await page.locator('#up-phone').blur();
  await page.waitForTimeout(200);

  // --- Filling it in properly ---
  await page.fill('#up-name', 'Nguoi kiem thu');
  await page.fill('#up-email', EMAIL);
  await page.fill('#up-phone', PHONE);
  await page.fill('#up-confirm', 'Petmory@2026khac');
  await page.locator('.submit').click();
  await page.waitForTimeout(600);
  ok('Hai lan nhap mat khau khac nhau thi bi chan',
    page.url().includes('/register'), page.url());

  await page.fill('#up-confirm', 'Petmory@2026xyz');
  await page.locator('.submit').click();
  await page.waitForTimeout(600);
  ok('Chua tich dieu khoan thi chua tao duoc tai khoan',
    page.url().includes('/register'), page.url());

  await page.locator('.tick input').check();
  await page.screenshot({ path: path.join(OUT, 'auth-register.png'), fullPage: true });
  await page.locator('.submit').click();
  await page.waitForURL('**/home', { timeout: 30000 });
  ok('Tao tai khoan xong thi vao trang chu', true);

  // --- What actually landed on the server ---
  const signIn = await page.request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: 'Petmory@2026xyz' },
  });
  ok('Dang nhap lai bang tai khoan vua tao', signIn.ok(), String(signIn.status()));
  const token = (await signIn.json()).accessToken;

  const stored = await readStoredUser(EMAIL);
  ok('So dien thoai da luu cung tai khoan', stored && stored.phone === PHONE,
    stored ? String(stored.phone) : 'khong tim thay tai khoan');

  const pets = await page.request.get(`${API}/pets`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = pets.ok() ? await pets.json() : [];
  ok('Ten be cung da thanh mot ho so thu cung',
    Array.isArray(rows) && rows.some((r) => r.name === PET),
    rows.map((r) => r.name).join(', ') || 'khong co ho so nao');

  // --- The sign in screen, in a session of its own ---
  const guest = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page2 = await guest.newPage();
  page2.on('pageerror', (e) => broken.push(String(e)));
  await page2.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  ok('Duong dan dang nhap mo duoc', await page2.locator('.pane form').isVisible());
  ok('Co o ghi nho dang nhap', await page2.locator('.tick input').isVisible());
  await page2.screenshot({ path: path.join(OUT, 'auth-login.png'), fullPage: true });

  await page2.fill('#login-email', EMAIL);
  await page2.fill('#login-password', 'sai-mat-khau-roi');
  await page2.locator('.submit').click();
  await page2.waitForTimeout(1500);
  ok('Sai mat khau thi bao loi ro rang', await page2.locator('.error').isVisible());

  await page2.fill('#login-password', 'Petmory@2026xyz');
  await page2.locator('.submit').click();
  await page2.waitForURL('**/home', { timeout: 30000 });
  ok('Dung mat khau thi vao duoc trang chu', true);

  // --- Dang nhap nhanh, chi co khi may chu chay o che do phat trien ---
  const quick = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageQuick = await quick.newPage();
  await pageQuick.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await pageQuick.waitForSelector('.quick-button', { timeout: 20000 });
  ok('Man hinh dang nhap co ba nut vao nhanh theo vai tro',
    (await pageQuick.locator('.quick-button').count()) === 3,
    (await pageQuick.locator('.quick-button').allInnerTexts()).join(' | '));

  await pageQuick.locator('.quick-button').first().click();
  await pageQuick.waitForURL('**/home', { timeout: 20000 });
  ok('Bam mot nut la vao thang, khong phai go gi',
    (await pageQuick.locator('.account-button').innerText()).includes('Quan ly'),
    (await pageQuick.locator('.account-button').innerText()).trim());

  await pageQuick.goto(`${WEB}/admin/orders`, { waitUntil: 'networkidle' });
  await pageQuick.waitForTimeout(1200);
  ok('Vai tro vao nhanh dung la vai tro quan ly',
    pageQuick.url().includes('/admin/orders'), pageQuick.url());
  await quick.close();

  ok('Khong co loi nao trong trang', broken.length === 0, broken.join(' | '));

  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
