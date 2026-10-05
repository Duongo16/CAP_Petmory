/**
 * Browser test of password recovery: the forgot page, the email (read from the
 * API log because development has no SMTP server), the reset page, signing in
 * with the new password, and links that are reused, wrong or missing.
 *
 * Run: API_LOG=<duong-dan-nhat-ky-api> node tools/test-password-reset.js
 * Without API_LOG the steps after sending the email are skipped.
 */
const { chromium } = require('playwright');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `reset.${Date.now()}@petmory.local`;
const OLD_PASSWORD = 'Password@123';
const NEW_PASSWORD = 'NewPassword@456';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Ma dat lai moi nhat gui toi mot dia chi, doc tu nhat ky API. */
async function tokenFromLog(logPath, email) {
  for (let i = 0; i < 20; i += 1) {
    const text = fs.readFileSync(logPath, 'utf8');
    const at = text.lastIndexOf(`thu gui toi ${email}`);
    if (at >= 0) {
      const match = /reset-password\?token=([a-f0-9]{64})/.exec(text.slice(at));
      if (match) {
        return match[1];
      }
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return null;
}

async function login(page, password) {
  const res = await page.request.post(`${API}/auth/login`, { data: { email: EMAIL, password } });
  return res.status();
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const res = [];
  try {
    console.log('PASSWORD RESET TEST');
    console.log('='.repeat(64));
    await page.request.post(`${API}/auth/register`, { data: { email: EMAIL, password: OLD_PASSWORD, fullName: 'Reset test' } });

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.click('a.ap-forgot');
    await page.waitForURL('**/forgot-password', { timeout: 15000 });
    res.push(check('"Forgot password?" on the sign-in page opens the forgot page', true));
    res.push(check('The sign-in page no longer shows social buttons that do nothing',
      (await page.goto(`${WEB}/login`).then(() => page.locator('.ap-social-btn').count())) === 0));

    await page.goto(`${WEB}/forgot-password`, { waitUntil: 'networkidle' });
    await page.fill('#forgot-email', EMAIL);
    await page.click('button[type="submit"]');
    await page.waitForSelector('#forgot-sent', { timeout: 15000 });
    res.push(check('Asking for a link shows the same neutral message', true));

    await page.goto(`${WEB}/forgot-password`, { waitUntil: 'networkidle' });
    await page.fill('#forgot-email', `khong.co.${Date.now()}@petmory.local`);
    await page.click('button[type="submit"]');
    await page.waitForSelector('#forgot-sent', { timeout: 15000 });
    res.push(check('An unknown email gets exactly the same answer', true));

    await page.goto(`${WEB}/reset-password`, { waitUntil: 'networkidle' });
    res.push(check('Opening the reset page without a link says it cannot be used',
      (await page.locator('#reset-expired').count()) === 1));

    await page.goto(`${WEB}/reset-password?token=${'0'.repeat(64)}`, { waitUntil: 'networkidle' });
    await page.fill('#reset-password', NEW_PASSWORD);
    await page.fill('#reset-confirm', NEW_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForSelector('#reset-expired', { timeout: 15000 });
    res.push(check('A wrong link is refused and offers to ask again', true));

    const logPath = process.env.API_LOG;
    if (!logPath) {
      console.log('  (bo qua cac buoc sau: chua dat API_LOG de doc thu tu nhat ky)');
    } else {
      const token = await tokenFromLog(logPath, EMAIL);
      res.push(check('The reset email carries a full link to the web reset page', Boolean(token)));
      if (token) {
        await page.goto(`${WEB}/reset-password?token=${token}`, { waitUntil: 'networkidle' });
        await page.fill('#reset-password', NEW_PASSWORD);
        await page.fill('#reset-confirm', 'khong-khop-123');
        await page.locator('#reset-confirm').blur();
        res.push(check('Two different passwords are caught before sending',
          (await page.locator('.ap-error-msg').count()) >= 1));
        await page.fill('#reset-confirm', NEW_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForSelector('#reset-done', { timeout: 15000 });
        res.push(check('The new password is saved', true));
        res.push(check('Signing in with the new password works', (await login(page, NEW_PASSWORD)) === 200));
        res.push(check('The old password no longer works', (await login(page, OLD_PASSWORD)) === 401));

        await page.goto(`${WEB}/reset-password?token=${token}`, { waitUntil: 'networkidle' });
        await page.fill('#reset-password', 'Another@789');
        await page.fill('#reset-confirm', 'Another@789');
        await page.click('button[type="submit"]');
        await page.waitForSelector('#reset-expired', { timeout: 15000 });
        res.push(check('A link that was already used cannot be used again', true));
      }
    }
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
