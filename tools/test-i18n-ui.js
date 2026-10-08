/**
 * Browser test of the language switch: the toggle on the guest landing page,
 * the sign-in page and the main header, the choice surviving a reload, and a
 * few key screens reading in English. Texts are compared with the translation
 * files rather than typed here, so the test follows the wording.
 * Run: node tools/test-i18n-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const { petWithPhotos, passPhotoStep } = require('./lib/made-to-order');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EN = require(path.join(__dirname, '..', 'apps', 'web', 'public', 'i18n', 'en.json'));
const VI = require(path.join(__dirname, '..', 'apps', 'web', 'public', 'i18n', 'vi.json'));
const EMAIL = `i18n.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function bodyHas(page, text) {
  await page.waitForTimeout(400);
  return (await page.locator('body').innerText()).includes(text);
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('LANGUAGE SWITCH TEST');
    console.log('='.repeat(64));

    await page.goto(`${WEB}/landing`, { waitUntil: 'networkidle' });
    res.push(check('The site opens in Vietnamese by default',
      (await page.locator('html').getAttribute('lang')) === 'vi' && (await bodyHas(page, VI.AUTH.SIGN_IN))));
    await page.locator('pm-language-toggle button').click();
    res.push(check('The landing page switches to English',
      (await page.locator('html').getAttribute('lang')) === 'en' && (await bodyHas(page, EN.AUTH.SIGN_IN))));

    await page.reload({ waitUntil: 'networkidle' });
    res.push(check('The choice survives a reload', await bodyHas(page, EN.AUTH.SIGN_IN)));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    res.push(check('The sign-in page reads in English and has the toggle',
      (await bodyHas(page, EN.AUTH.LOGIN_TITLE)) && (await page.locator('pm-language-toggle').count()) === 1));
    await page.goto(`${WEB}/forgot-password`, { waitUntil: 'networkidle' });
    res.push(check('The forgot-password page reads in English', await bodyHas(page, EN.AUTH.FORGOT_TITLE)));

    const made = await (await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'I18n test' },
    })).json();
    // Studio bat dau tu anh cua be, nen khach can san mot be co anh.
    const petId = await petWithPhotos(made.accessToken, 1, 'Be i18n');
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    res.push(check('The main header offers the toggle', (await page.locator('header pm-language-toggle, pm-language-toggle').count()) >= 1));
    res.push(check('The main menu reads in English', await bodyHas(page, EN.NAV.STUDIO)));

    await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
    res.push(check('The cart reads in English', await bodyHas(page, EN.CART.EMPTY)));
    await page.goto(`${WEB}/designs`, { waitUntil: 'networkidle' });
    res.push(check('My designs reads in English', await bodyHas(page, EN.DESIGNS.TITLE)));
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.drawer .tab', { timeout: 40000 });
    res.push(check('The 3D studio reads in English', await bodyHas(page, EN.STUDIO.TAB.STAND)));
    const firstTab = (await page.locator('.drawer .tab').first().innerText()).trim();
    res.push(check('The studio opens on the model step, labelled in English',
      firstTab.includes(EN.STUDIO.TAB.MODEL)
        && (await page.locator('.drawer .tab').first().getAttribute('aria-selected')) === 'true'
        && (await bodyHas(page, EN.STUDIO.PANEL.MODEL)), firstTab));
    // Tieu de khung duoc in hoa bang giao dien nen so khop khong phan biet hoa thuong.
    const matchBox = (await page.locator('#studio-match-box').innerText()).toLowerCase();
    res.push(check('The build-from-photos box reads in English',
      matchBox.includes(EN.STUDIO.MATCH.TITLE.toLowerCase()) && matchBox.includes(EN.STUDIO.MATCH.RUN.toLowerCase()), matchBox.slice(0, 80)));
    res.push(check('No step is locked',
      !(await page.locator('.drawer .tab[data-step="PHOTOS"]').isDisabled())));
    await passPhotoStep(page, petId);
    res.push(check('After building, the result reads in English',
      (await bodyHas(page, EN.STUDIO.MATCH.MODEL)) && (await bodyHas(page, EN.STUDIO.TAB.MODEL))));
    await page.locator('.drawer .tab[data-step="PHOTOS"]').click();
    res.push(check('The pet photos step reads in English', await bodyHas(page, EN.STUDIO.PANEL.PHOTOS)));

    await page.locator('pm-language-toggle button').first().click();
    res.push(check('Switching back gives Vietnamese again', await bodyHas(page, VI.STUDIO.TAB.STAND)));
    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
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
