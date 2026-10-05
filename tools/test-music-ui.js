/**
 * Browser test of the slideshow music library (SOW item 19): the manager opens the
 * music tab, adds the sample tracks and a custom one, and the save request carries
 * a clean list. The save itself is answered by the test so the shared database is
 * not changed; the server rules are checked with requests that it must refuse.
 * Run: node tools/test-music-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const api = await request.newContext();
  const res = [];
  try {
    console.log('MUSIC LIBRARY TEST');
    console.log('='.repeat(64));
    const login = await api.post(`${API}/auth/login`, { data: MANAGER });
    const auth = { Authorization: `Bearer ${(await login.json()).accessToken}` };
    const bad = await api.patch(`${API}/settings`, {
      headers: auth,
      data: { musicLibrary: [{ code: 'A1', title: 'Bai', url: 'javascript:alert(1)' }] },
    });
    res.push(check('The server refuses a track link that is not a web or music file link', bad.status() === 400, String(bad.status())));
    const twice = await api.patch(`${API}/settings`, {
      headers: auth,
      data: {
        musicLibrary: [
          { code: 'TRUNG', title: 'Mot', url: '/music/a.wav' },
          { code: 'TRUNG', title: 'Hai', url: '/music/b.wav' },
        ],
      },
    });
    res.push(check('The server refuses two tracks with the same code', twice.status() === 400, String(twice.status())));
    const audio = await api.get(`${WEB}/music/hop-nhac-diu-dang.wav`);
    res.push(check('The sample track file is served', audio.status() === 200 && (await audio.body()).length > 100000));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/admin/settings?tab=music`, { waitUntil: 'networkidle' });
    await page.waitForSelector('pm-music-library-panel .add-demo', { timeout: 15000 });
    res.push(check('The music tab hides the main settings save bar',
      !(await page.locator('.config-actions-bar').isVisible().catch(() => false))));

    const before = await page.locator('.music-row').count();
    await page.click('.add-demo');
    await page.click('.add-demo');
    const afterDemo = await page.locator('.music-row').count();
    res.push(check('Sample tracks are added once only', afterDemo >= before && afterDemo <= before + 2, `${before} -> ${afterDemo}`));
    res.push(check('Each valid track gets a preview player', (await page.locator('.music-row audio').count()) >= 2));

    await page.click('.add-track');
    const fresh = page.locator(`.music-row[data-index="${afterDemo}"]`);
    await fresh.waitFor({ timeout: 10000 });
    await fresh.locator('.music-title').fill('Chiều Đà Lạt');
    await fresh.locator('.music-url').fill('ftp://sai');
    let sent = null;
    await page.route('**/api/settings', async (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.continue();
      }
      sent = route.request().postDataJSON();
      const current = await (await api.get(`${API}/settings`, { headers: auth })).json();
      return route.fulfill({ json: { ...current, musicLibrary: sent.musicLibrary } });
    });
    await page.click('.save-music');
    const caught = await page.waitForSelector('.music-alert', { timeout: 5000 }).then(() => true, () => false);
    res.push(check('A wrong link is caught before saving', sent === null && caught));

    await fresh.locator('.music-url').fill('https://cdn.example.com/chieu-da-lat.mp3');
    await page.click('.save-music');
    await page.waitForSelector('.music-saved', { timeout: 10000 });
    const list = (sent && sent.musicLibrary) || [];
    const mine = list.find((one) => one.title === 'Chiều Đà Lạt');
    res.push(check('The new track gets a code made from its name', mine && mine.code === 'CHIEU_DA_LAT', mine && mine.code));
    res.push(check('Only track fields are sent and codes are unique',
      list.length === afterDemo + 1 && new Set(list.map((one) => one.code)).size === list.length
      && list.every((one) => Object.keys(one).every((k) => ['code', 'title', 'url', 'credit'].includes(k)))));
    res.push(check('After saving the code shows on the row', (await fresh.locator('.music-code').innerText()) === 'CHIEU_DA_LAT'));
    await page.screenshot({ path: path.join(OUT, 'music-library.png'), fullPage: true });
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
