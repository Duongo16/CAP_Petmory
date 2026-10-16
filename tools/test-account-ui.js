/**
 * Kiem thu popup ho so ca nhan (SOW muc 2): sua ho ten va so dien thoai, doi
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
    console.log('PROFILE EDIT POPUP TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Tai khoan test' } })).json();
    const userId = made.user.id;

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });

    // Menu avatar dua thang toi cac trang rieng cua khach, trong do co Thiet ke cua toi.
    await page.locator('.account-button').click();
    await page.waitForSelector('.account-menu', { timeout: 10000 });
    const designsLink = page.locator('.account-menu .personal-link[data-path="/designs"]');
    res.push(check('The avatar menu lists My designs', (await designsLink.innerText()).includes('Thiết kế của tôi')));
    await designsLink.click();
    await page.waitForURL('**/designs', { timeout: 15000 });
    res.push(check('My designs opens from the avatar menu', page.url().endsWith('/designs'), page.url()));

    await page.goto(`${WEB}/community/users/${userId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("Chỉnh sửa")', { timeout: 20000 });
    await page.click('button:has-text("Chỉnh sửa")');
    await page.waitForSelector('#profile-name', { timeout: 10000 });
    res.push(check('The profile edit popup opens with the current name', (await page.inputValue('#profile-name')) === 'Tai khoan test'));

    await page.fill('#profile-phone', '12345');
    await page.click('button[form="profile-edit-form"]');
    res.push(check('A wrong phone number is caught',
      await page.locator('#profile-phone').locator('..').locator('.field-error').waitFor({ timeout: 5000 }).then(() => true, () => false)));
    await page.fill('#profile-name', 'Nguyen Tai Khoan');
    await page.fill('#profile-phone', '0912345678');
    await page.click('button[form="profile-edit-form"]');
    await page.waitForSelector('#profile-name', { state: 'detached', timeout: 10000 });
    const mine = await (await api.get(`${API}/community/users/${userId}`, { headers: { Authorization: `Bearer ${made.accessToken}` } })).json();
    res.push(check('The new name and phone are saved', mine.fullName === 'Nguyen Tai Khoan' && mine.phone === '0912345678'));
    const stranger = await (await api.get(`${API}/community/users/${userId}`)).json();
    res.push(check('The phone number does not show on the public profile', stranger.phone === null, String(stranger.phone)));

    await page.click('button:has-text("Chỉnh sửa")');
    await page.waitForSelector('#profile-current-password', { timeout: 10000 });
    await page.fill('#profile-current-password', 'sai-mat-khau');
    await page.fill('#profile-new-password', NEW_PASSWORD);
    await page.fill('#profile-confirm-password', NEW_PASSWORD);
    await page.click('.password-section button[type="submit"]');
    res.push(check('A wrong current password is refused',
      await page.waitForSelector('.password-section .field-error:not(.success-note)', { timeout: 10000 }).then(() => true, () => false)));
    await page.fill('#profile-current-password', PASSWORD);
    await page.fill('#profile-new-password', NEW_PASSWORD);
    await page.fill('#profile-confirm-password', NEW_PASSWORD);
    await page.click('.password-section button[type="submit"]');
    await page.waitForSelector('.password-section .success-note', { timeout: 15000 });
    res.push(check('The password is changed', true));
    const oldLogin = await api.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    const newLogin = await api.post(`${API}/auth/login`, { data: { email: EMAIL, password: NEW_PASSWORD } });
    res.push(check('Only the new password signs in afterwards', oldLogin.status() === 401 && newLogin.ok(), `${oldLogin.status()} / ${newLogin.status()}`));
    const oldToken = await api.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${made.accessToken}` } });
    res.push(check('Sessions opened before the change are ended', oldToken.status() === 401, String(oldToken.status())));
    await page.reload({ waitUntil: 'networkidle' });
    res.push(check('The current browser stays signed in', page.url().endsWith(`/community/users/${userId}`)));

    const manager = { Authorization: `Bearer ${(await (await api.post(`${API}/auth/login`, { data: MANAGER })).json()).accessToken}` };
    const log = await (await api.get(`${API}/admin/audit?resourceType=User&resourceId=${userId}`, { headers: manager })).json();
    const actions = (log.rows ?? []).map((one) => one.action);
    res.push(check('The profile change and password change are logged, without the password',
      actions.includes('USER_PROFILE_UPDATED') && actions.includes('ACCOUNT_PASSWORD_CHANGED')
      && !JSON.stringify(log.rows).includes(NEW_PASSWORD), actions.join(',')));
    await page.screenshot({ path: path.join(OUT, 'profile-page.png'), fullPage: true });
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
