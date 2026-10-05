/**
 * Browser test of community moderation (SOW item 20): the manager hides a public
 * journal with a reason, it disappears from the public community, and showing it
 * again brings it back. The support desk cannot open moderation.
 * Run: node tools/test-moderation-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const SUPPORT = { email: 'cskh@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');
const PET_NAME = `KiemDuyet${Date.now() % 100000}`;

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function signIn(page, who) {
  await page.context().clearCookies();
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', who.email);
  await page.fill('input[formcontrolname="password"]', who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const res = [];
  try {
    console.log('COMMUNITY MODERATION TEST');
    console.log('='.repeat(64));
    const made = await page.request.post(`${API}/auth/register`, {
      data: { email: `mod.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Mod test' },
    });
    const owner = { Authorization: `Bearer ${(await made.json()).accessToken}` };
    const pet = await (await page.request.post(`${API}/pets`, { headers: owner, data: { name: PET_NAME } })).json();
    await page.request.patch(`${API}/memories/pet/${pet._id}/privacy`, { headers: owner, data: { isPublic: true } });
    res.push(check('The journal starts out public', (await page.request.get(`${API}/diaries/${pet._id}`)).status() === 200));

    await signIn(page, MANAGER);
    res.push(check('The manager sees the moderation menu',
      (await page.locator('a[href="/admin/moderation"]').count()) >= 1));
    await page.goto(`${WEB}/admin/moderation`, { waitUntil: 'networkidle' });
    await page.fill('#search-diary', PET_NAME);
    await page.keyboard.press('Enter');
    const card = page.locator(`.mod-card[data-pet="${pet._id}"]`);
    await card.waitFor({ timeout: 15000 });
    res.push(check('The public journal is listed', true));

    await card.locator('.hide-button').click();
    await card.locator('textarea').fill('abc');
    await card.locator('button[type="submit"]').click();
    res.push(check('A reason that is too short is refused',
      await page.waitForSelector('.mod-alert', { timeout: 5000 }).then(() => true, () => false)));
    await card.locator('textarea').fill('Dang anh khong phu hop voi cong dong');
    await card.locator('button[type="submit"]').click();
    await page.waitForFunction((id) => !document.querySelector(`.mod-card[data-pet="${id}"]`), pet._id, { timeout: 15000 });
    res.push(check('Once hidden the journal leaves the public list', true));
    res.push(check('The public community no longer serves it',
      (await page.request.get(`${API}/diaries/${pet._id}`)).status() !== 200));

    await page.locator('.mod-tabs [data-tab="BLOCKED"]').click();
    await page.fill('#search-diary', PET_NAME);
    await page.keyboard.press('Enter');
    await card.waitFor({ timeout: 15000 });
    res.push(check('The hidden tab shows it with the reason',
      (await card.locator('.mod-reason').innerText()).includes('khong phu hop')));
    await page.screenshot({ path: path.join(OUT, 'moderation.png') });
    await card.locator('.unhide-button').click();
    await page.waitForFunction((id) => !document.querySelector(`.mod-card[data-pet="${id}"]`), pet._id, { timeout: 15000 });
    res.push(check('Showing it again puts it back in the community',
      (await page.request.get(`${API}/diaries/${pet._id}`)).status() === 200));

    await signIn(page, SUPPORT);
    await page.waitForSelector('a[href="/admin/orders"]', { timeout: 15000 });
    res.push(check('The support desk has no moderation menu',
      (await page.locator('a[href="/admin/moderation"]').count()) === 0));
    await page.goto(`${WEB}/admin/moderation`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    res.push(check('The support desk is turned away from moderation',
      !page.url().includes('/admin/moderation'), page.url()));
    const deskLogin = await (await page.request.post(`${API}/auth/login`, { data: SUPPORT })).json();
    const deskList = await page.request.get(`${API}/admin/diaries`, {
      headers: { Authorization: `Bearer ${deskLogin.accessToken}` },
    });
    res.push(check('The moderation list API refuses the support desk', deskList.status() === 403,
      String(deskList.status())));
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
