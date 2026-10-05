/**
 * Browser test of the AI pet story screen (SOW item 16): a customer writes a story,
 * rewrites it into a second version, edits it by hand, attaches it to a journal
 * moment and removes a version. Each step is checked against the server too.
 * Run: node tools/test-story-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `story.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
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
    console.log('AI PET STORY TEST');
    console.log('='.repeat(64));
    const made = await api.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Story test' } });
    const auth = { Authorization: `Bearer ${(await made.json()).accessToken}` };
    const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Bong' } })).json();
    const moment = await (await api.post(`${API}/memories`, {
      headers: auth,
      data: { pet: pet._id, title: 'Lan dau di bien', body: 'Noi dung cu', happenedAt: '2026-05-01' },
    })).json();
    res.push(check('Test data is ready', Boolean(pet._id && moment._id)));

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });

    await page.goto(`${WEB}/pets/${pet._id}/journal`, { waitUntil: 'networkidle' });
    await page.click('.story-link');
    await page.waitForURL(`**/pets/${pet._id}/story`, { timeout: 15000 });
    await page.waitForSelector('#story-write', { timeout: 15000 });
    res.push(check('The journal toolbar opens the story screen', true));
    const quotaBefore = (await (await api.get(`${API}/pet-stories/quota`, { headers: auth })).json()).left;

    await page.click('[data-tone="PLAYFUL"]');
    await page.fill('#story-notes', 'Be thich nam phoi nang o bau cua');
    await page.click('#story-write');
    await page.waitForSelector('.version', { timeout: 90000 });
    const first = (await (await api.get(`${API}/pet-stories?petId=${pet._id}`, { headers: auth })).json());
    res.push(check('Writing creates the first version with the chosen tone',
      first.length === 1 && first[0].tone === 'PLAYFUL' && first[0].notes.includes('phoi nang')));
    res.push(check('The editor shows the new story', (await page.inputValue('#story-content')).length > 20));
    if (quotaBefore >= 0) {
      await page.waitForFunction((n) => (document.querySelector('#story-quota')?.textContent ?? '').includes(String(n)), quotaBefore - 1, { timeout: 10000 })
        .catch(() => undefined);
      res.push(check('The remaining writes go down by one',
        (await page.locator('#story-quota').innerText()).includes(String(quotaBefore - 1))));
    }

    await page.fill('#story-rewrite-notes', 'Them chuyen be so song bien');
    await page.click('#story-rewrite');
    await page.waitForFunction(() => document.querySelectorAll('.version').length === 2, null, { timeout: 90000 });
    res.push(check('Rewriting adds a second version and keeps the first',
      (await page.locator('.version.on').innerText()).includes('2')));

    await page.fill('#story-title', 'Bong va bien xanh');
    await page.fill('#story-content', 'Bong lan dau thay bien, chay lui chay toi theo tung con song.');
    await page.click('#story-save');
    await page.waitForSelector('.story-notice', { timeout: 15000 });
    const edited = (await (await api.get(`${API}/pet-stories?petId=${pet._id}`, { headers: auth })).json())[0];
    res.push(check('A hand edit is saved and marked as edited by a person',
      edited.title === 'Bong va bien xanh' && edited.hand === 'PERSON'));

    await page.selectOption('#story-attach-to', moment._id);
    await page.click('#story-attach');
    await page.waitForSelector('.attached-now', { timeout: 15000 });
    const page1 = await (await api.get(`${API}/memories/pet/${pet._id}?page=1`, { headers: auth })).json();
    const stored = page1.rows.find((one) => one._id === moment._id);
    res.push(check('Attaching puts the story into the journal moment', stored && stored.body.startsWith('Bong lan dau thay bien')));
    res.push(check('The version shows it is in the journal', (await page.locator('.version.on .tw-badge-success').count()) === 1));
    await page.screenshot({ path: path.join(OUT, 'story-page.png'), fullPage: true });

    // Trang nhat ky co nut doc cau chuyen tren dung khoanh khac da gan.
    const storyUrl = page.url();
    await page.goto(`${WEB}/pets/${pet._id}/journal`, { waitUntil: 'networkidle' });
    await page.locator('.view-switch button:has-text("Dòng thời gian")').click();
    await page.waitForSelector('.moment', { timeout: 20000 });
    const withStory = page.locator('.moment', { has: page.locator('.moment-story') });
    res.push(check('The journal marks the moment that has a story', (await withStory.count()) === 1,
      String(await withStory.count())));
    await withStory.locator('.moment-story').click();
    await page.waitForSelector('#story-read-title', { timeout: 10000 });
    res.push(check('Reading opens the attached story', (await page.locator('#story-read-title').innerText()).includes('Bong va bien xanh')));
    res.push(check('The whole story text is shown',
      (await page.locator('.story-text').innerText()).includes('chay lui chay toi theo tung con song')));
    await page.screenshot({ path: path.join(OUT, 'story-in-journal.png') });
    await page.keyboard.press('Escape');
    await page.goto(storyUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('.version', { timeout: 20000 });

    await page.click('.version:not(.on)');
    await page.click('#story-remove');
    await page.click('#story-remove');
    await page.waitForFunction(() => document.querySelectorAll('.version').length === 1, null, { timeout: 15000 });
    const left = await (await api.get(`${API}/pet-stories?petId=${pet._id}`, { headers: auth })).json();
    res.push(check('Removing needs a second click and hides that version only', left.length === 1 && left[0]._id === edited._id));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    res.push(check('The screen fits a phone without sideways scrolling', wide <= 390, String(wide)));
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
