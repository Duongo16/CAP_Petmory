/**
 * Browser test of the pet profile form.
 *
 * The form used to sit permanently on the page with four free text boxes. It is
 * now a dialog with proper choices, two dates, and room for several pictures,
 * and the memorial date has to appear only when it actually applies.
 *
 * Run: node tools/test-pets-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `thucung.${STAMP}@petmory.local`;

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

/**
 * Waits for the development server to finish compiling.
 *
 * While it is rebuilding, an error overlay covers the page and swallows every
 * click, so a test would fail for a reason that has nothing to do with what it
 * is checking. A plain loop is used rather than waitForFunction, which has been
 * seen to hang here.
 */
async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 60 giay');
}

async function makePhoto(tint) {
  return sharp({
    create: { width: 600, height: 600, channels: 3, background: tint },
  })
    .png()
    .toBuffer();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('PET PROFILE FORM');
  console.log('='.repeat(64));

  await page.request.post(`${API}/auth/register`,
    { data: { email: EMAIL, password: 'Password@123', fullName: 'Chu cua be' } });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'Password@123');
  await page.click('button[type=submit]');
  /*
   * Bam mot lan nua neu lan dau khong sang duoc trang chu.
   *
   * Khi may ban, lan bam dau co the roi vao luc trang chua san sang nhan, va
   * bai kiem thu se hong vi mot ly do khong lien quan gi den thu no dang
   * kiem. Bam lai mot lan la du, va van hong that neu dang nhap that su sai.
   */
  await page.waitForURL('**/home', { timeout: 30000 }).catch(async () => {
    await page.click('button[type=submit]');
    await page.waitForURL('**/home', { timeout: 40000 });
  });

  await page.goto(`${WEB}/pets`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(1000);

  ok('Form khong con nam san tren trang', (await page.locator('.sheet').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'pets-1-empty.png'), fullPage: true });

  // --- The dialog opens ---
  await page.locator('.strong').first().click();
  await page.waitForSelector('.sheet', { timeout: 15000 });
  ok('Bam them thi mo ra hop thoai', await page.locator('.sheet').isVisible());

  // --- Choices are dropdowns, not free text ---
  const kindOptions = await page.locator('#pet-kind option').count();
  ok('Loai thu cung la hop chon', kindOptions === 6, `${kindOptions} lua chon`);
  const genderOptions = await page.locator('#pet-gender option').count();
  ok('Gioi tinh la hop chon', genderOptions === 3, `${genderOptions} lua chon`);

  // --- The memorial date only appears when it applies ---
  ok('Ngay roi xa an khi be con o cung', (await page.locator('#pet-gone').count()) === 0);
  await page.selectOption('#pet-status', 'PASSED_AWAY');
  await page.waitForTimeout(400);
  ok('Chon da roi xa thi o ngay hien ra', (await page.locator('#pet-gone').count()) === 1);
  await page.selectOption('#pet-status', 'TOGETHER');
  await page.waitForTimeout(400);
  ok('Chon lai o cung thi o ngay an di', (await page.locator('#pet-gone').count()) === 0);

  // --- Dates cannot be in the future ---
  const maxBirth = await page.locator('#pet-birth').getAttribute('max');
  const today = new Date().toISOString().slice(0, 10);
  ok('O ngay sinh khong cho chon ngay tuong lai', maxBirth === today, String(maxBirth));

  // --- A memorial profile without a date is refused ---
  await page.fill('#pet-name', `Be Mun ${STAMP}`);
  await page.selectOption('#pet-kind', 'CAT');
  await page.selectOption('#pet-status', 'PASSED_AWAY');
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  ok('Thieu ngay roi xa thi khong dong hop thoai',
    (await page.locator('.sheet').count()) === 1);
  ok('Va bao loi ro rang', (await page.locator('.field-error').count()) >= 1);
  await page.screenshot({ path: path.join(OUT, 'pets-2-dialog.png') });

  // --- Several pictures at once ---
  const files = [];
  for (const [i, tint] of [{ r: 200, g: 150, b: 120 }, { r: 120, g: 160, b: 200 }].entries()) {
    const where = path.join(OUT, `pet-anh-${i}.png`);
    fs.writeFileSync(where, await makePhoto(tint));
    files.push(where);
  }
  await page.setInputFiles('#pet-photos', files);
  await page.waitForTimeout(400);
  ok('Chon duoc nhieu anh cung luc',
    (await page.locator('pm-photo-previews .tile img').count()) === 2,
    `${await page.locator('pm-photo-previews .tile img').count()} anh`);

  await page.locator('pm-photo-previews .tile-drop').first().click();
  await page.waitForTimeout(300);
  ok('Bo bot mot anh duoc', (await page.locator('pm-photo-previews .tile img').count()) === 1);

  // --- Saving properly ---
  await page.fill('#pet-gone', '2025-03-14');
  await page.fill('#pet-birth', '2018-06-02');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);
  ok('Du ngay thi luu duoc va hop thoai dong lai',
    (await page.locator('.sheet').count()) === 0);

  const cards = page.locator('.pet-card');
  // Cho den khi the that su hien ra, thay vi doan mot khoang thoi gian.
  await cards.first().waitFor({ state: 'visible', timeout: 20000 });
  ok('Ho so hien trong danh sach', (await cards.count()) === 1, `${await cards.count()} the`);
  const text = await cards.first().innerText();
  ok('The hien loai thu cung theo nhan tieng Viet', text.includes('Mèo'), text.split('\n')[1] ?? '');
  ok('The hien ca ngay sinh va ngay roi xa',
    text.includes('02/06/2018') && text.includes('14/03/2025'));
  await page.screenshot({ path: path.join(OUT, 'pets-3-list.png'), fullPage: true });

  // --- The picture really arrived ---
  // Doc qua giao dien chu khong moc token tu bo nho, vi noi cat token la viec
  // rieng cua lop chan yeu cau, bai kiem thu khong nen biet toi.
  await page.locator('.pet-deeds a').first().click();
  await page.waitForURL('**/journal?view=photos', { timeout: 20000 });
  await settle(page);
  // Anh duoc tai qua duong co kiem tra quyen, nen doi den khi no hien ra.
  await page.locator('pm-pet-photos .shot img').first().waitFor({ state: 'visible', timeout: 25000 });
  const shown = await page.locator('pm-pet-photos .shot img').count();
  ok('Anh da len may chu va hien o trang anh cua be', shown >= 1, `${shown} anh`);

  await page.screenshot({ path: path.join(OUT, 'pets-4-photos.png'), fullPage: true });

  await page.goto(`${WEB}/pets`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(1200);

  // --- Editing reopens the same form, filled in ---
  await page.locator('.pet-deeds [aria-label="Sửa"]').first().click();
  await page.waitForSelector('.sheet', { timeout: 15000 });
  ok('Bam sua thi mo lai dung hop thoai do', await page.locator('.sheet').isVisible());
  ok('Ten da duoc dien san',
    (await page.locator('#pet-name').inputValue()).includes('Be Mun'));
  ok('Ngay roi xa da duoc dien san',
    (await page.locator('#pet-gone').inputValue()) === '2025-03-14');

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  for (const one of files) {
    fs.rmSync(one, { force: true });
  }
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})();
