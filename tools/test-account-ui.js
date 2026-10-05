/**
 * Kiem thu trang Tai khoan cua toi (SOW muc 2): sua ho ten va so dien thoai, doi
 * mat khau bang mat khau cu; so dien thoai khong lo ra ho so cong khai; viec sua
 * ho so va doi mat khau co ghi nhat ky.
 * Run: node tools/test-account-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `taikhoan.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const NEW_PASSWORD = 'MatKhauMoi@456';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('MY ACCOUNT TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Tai khoan test' } })).json();
    const userId = made.user.id;

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/account`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#account-name', { timeout: 20000 });
    res.push(check('The account page opens with the current name', (await page.inputValue('#account-name')) === 'Tai khoan test'));

    await page.fill('#account-phone', '12345');
    await page.click('#account-save');
    res.push(check('A wrong phone number is caught',
      await page.waitForSelector('.account-note.bad', { timeout: 5000 }).then(() => true, () => false)));
    await page.fill('#account-name', 'Nguyen Tai Khoan');
    await page.fill('#account-phone', '0912345678');
    await page.click('#account-save');
    await page.waitForSelector('.account-note:not(.bad)', { timeout: 10000 });
    const mine = await (await api.get(`${API}/community/users/${userId}`, { headers: { Authorization: `Bearer ${made.accessToken}` } })).json();
    res.push(check('The new name and phone are saved', mine.fullName === 'Nguyen Tai Khoan' && mine.phone === '0912345678'));
    const stranger = await (await api.get(`${API}/community/users/${userId}`)).json();
    res.push(check('The phone number does not show on the public profile', stranger.phone === null, String(stranger.phone)));

    await page.fill('#account-current', 'sai-mat-khau');
    await page.fill('#account-new', NEW_PASSWORD);
    await page.fill('#account-confirm', NEW_PASSWORD);
    await page.click('#account-change-password');
    res.push(check('A wrong current password is refused',
      await page.waitForFunction(() => document.querySelectorAll('.account-note.bad').length > 0, null, { timeout: 10000 }).then(() => true, () => false)));
    await page.fill('#account-current', PASSWORD);
    await page.fill('#account-new', NEW_PASSWORD);
    await page.fill('#account-confirm', NEW_PASSWORD);
    await page.click('#account-change-password');
    await page.waitForFunction(() => [...document.querySelectorAll('.account-note')].some((el) => !el.classList.contains('bad')
      && el.closest('section')?.querySelector('#account-current')), null, { timeout: 15000 });
    res.push(check('The password is changed', true));
    const oldLogin = await api.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    const newLogin = await api.post(`${API}/auth/login`, { data: { email: EMAIL, password: NEW_PASSWORD } });
    res.push(check('Only the new password signs in afterwards', oldLogin.status() === 401 && newLogin.ok(), `${oldLogin.status()} / ${newLogin.status()}`));
    const oldToken = await api.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${made.accessToken}` } });
    res.push(check('Sessions opened before the change are ended', oldToken.status() === 401, String(oldToken.status())));
    await page.reload({ waitUntil: 'networkidle' });
    res.push(check('The current browser stays signed in', page.url().endsWith('/account')));

    const manager = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken}` };
    const log = await (await api.get(`${API}/admin/audit?resourceType=User&resourceId=${userId}`, { headers: manager })).json();
    const actions = (log.rows ?? []).map((one) => one.action);
    res.push(check('The profile change and password change are logged, without the password',
      actions.includes('USER_PROFILE_UPDATED') && actions.includes('ACCOUNT_PASSWORD_CHANGED')
      && !JSON.stringify(log.rows).includes(NEW_PASSWORD), actions.join(',')));
    await page.screenshot({ path: path.join(OUT, 'account-page.png'), fullPage: true });
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
