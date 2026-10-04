/**
 * Browser test of the "yarn table" customiser: one screen, a stage on the left
 * and a tabbed drawer on the right.
 * Run: node tools/test-studio-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const EMAIL = `studio.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** A colour fingerprint of the drawing area, used to tell whether the image changed. */
async function fingerprint(page) {
  return page.evaluate(() => {
    const c = document.querySelector('pm-viewer-3d canvas');
    const t = document.createElement('canvas');
    t.width = c.width;
    t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    const count = new Map();
    for (let i = 0; i < d.length; i += 4 * 31) {
      const k = `${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`;
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).join('|');
  });
}

/** The tab that is open now, counted from one. */
function tabOpen(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.tab')).findIndex((b) => b.classList.contains('on')) + 1);
}

async function signIn(page) {
  await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Studio test' },
  });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', EMAIL);
  await page.fill('input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 20000 });
}

async function openStudio(page) {
  await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.drawer .tab', { timeout: 40000 });
  await page.waitForFunction(() => Boolean(document.querySelector('pm-viewer-3d canvas')), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('YARN TABLE CUSTOMISER TEST');
    console.log('='.repeat(64));

    await signIn(page);
    res.push(check('Sign in through the interface', true));
    await openStudio(page);

    const overflow = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    res.push(check('The workbench fits on one screen without page scroll', overflow <= 2, `${overflow}px extra`));
    res.push(check('All four tabs are shown', (await page.locator('.tab').count()) === 4));
    res.push(check('The first tab is open', (await tabOpen(page)) === 1));

    const countModel = await page.locator('.model').count();
    res.push(check('The model tab lists the base models', countModel > 0, `${countModel} models`));
    const canvas = await page.evaluate(() => {
      const c = document.querySelector('pm-viewer-3d canvas');
      return c ? { width: c.width, webgl: Boolean(c.getContext('webgl2') || c.getContext('webgl')) } : null;
    });
    res.push(check('There is a WebGL drawing area', Boolean(canvas?.webgl && canvas.width > 0)));
    res.push(check('The viewer draws no toolbar of its own', (await page.locator('pm-viewer-3d .toolbar').count()) === 0));

    await page.locator('.round-button[aria-pressed="true"]').first().click();
    await page.waitForTimeout(500);
    res.push(check('Auto-rotate can be switched off from the stage',
      (await page.locator('.stage-tools .round-button[aria-pressed="true"]').count()) === 0));

    const beforeAngle = await fingerprint(page);
    await page.locator('.angle').nth(1).click();
    await page.waitForTimeout(900);
    res.push(check('An angle pill moves the camera', (await fingerprint(page)) !== beforeAngle));
    await page.screenshot({ path: path.join(OUT, 'studio-1-model.png') });

    // --- Tab 2: yarn colours ---
    await page.locator('.drawer-foot .tw-btn-primary').click();
    await page.waitForTimeout(500);
    res.push(check('The next button opens the yarn tab', (await tabOpen(page)) === 2));
    const countBall = await page.locator('.yarn-ball').count();
    res.push(check('The yarn tab shows the palette as yarn balls', countBall > 0, `${countBall} balls`));

    await page.locator('.angle').first().click();
    await page.waitForTimeout(800);
    const before = await fingerprint(page);
    await page.locator('.yarn-ball').first().click();
    await page.waitForTimeout(250);
    res.push(check('Picking a yarn shows the held chip', (await page.locator('.held').count()) === 1));

    const box = await page.locator('.stage').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    const afterFill = await fingerprint(page);
    res.push(check('Tapping the plush paints it', before !== afterFill));
    res.push(check('The used yarn gets a mark', (await page.locator('.yarn-ball.used').count()) > 0));
    await page.screenshot({ path: path.join(OUT, 'studio-2-yarn.png') });

    await page.locator('.segmented button').nth(1).click();
    await page.waitForTimeout(250);
    res.push(check('Brush mode shows the brush slider', (await page.locator('.brush input[type="range"]').count()) === 1));

    await page.locator('.stage-tools .round-button').nth(1).click();
    await page.waitForTimeout(600);
    res.push(check('Undo from the stage puts the colour back', (await fingerprint(page)) !== afterFill));

    await page.locator('.held-drop').click();
    await page.waitForTimeout(250);
    res.push(check('The held yarn can be put down', (await page.locator('.held').count()) === 0));

    // --- Tab 3: engraving with a live tag ---
    await page.locator('.tab').nth(2).click();
    await page.waitForTimeout(400);
    await page.fill('input[formcontrolname="engravedName"]', 'Mun');
    await page.waitForTimeout(200);
    res.push(check('The wooden tag shows the engraved name live',
      (await page.locator('.tag-name').innerText()).trim() === 'Mun'));
    res.push(check('The design name is filled from the model',
      (await page.locator('input[formcontrolname="name"]').inputValue()).length > 0));
    await page.screenshot({ path: path.join(OUT, 'studio-3-engrave.png') });

    // --- Tab 4: wrap up, photos are taken by themselves ---
    await page.locator('.tab').nth(3).click();
    await page.waitForSelector('.photo', { timeout: 15000 });
    await page.waitForTimeout(600);
    const countPhoto = await page.locator('.photo').count();
    res.push(check('Opening the last tab captures six photos by itself', countPhoto === 6, `${countPhoto} photos`));
    res.push(check('Product cards are listed', (await page.locator('.product').count()) > 0));
    await page.locator('.product').first().click();
    await page.waitForTimeout(300);
    if ((await page.locator('.chips .chip').count()) > 0) {
      await page.locator('.chips .chip').first().click();
      await page.waitForSelector('.quote', { timeout: 10000 });
    }
    res.push(check('Choosing a product and size shows the price', (await page.locator('.quote').count()) === 1));
    const extra = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    res.push(check('The last tab still fits on one screen', extra <= 2, `${extra}px extra`));
    await page.screenshot({ path: path.join(OUT, 'studio-4-finish.png') });

    // --- Phone width ---
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tab').first().click();
    await page.waitForTimeout(800);
    const wide = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    res.push(check('No sideways scroll on a phone', wide <= 1, `${wide}px`));
    await page.screenshot({ path: path.join(OUT, 'studio-5-mobile.png'), fullPage: true });

    const realErrors = error.filter((l) => !/favicon/i.test(l));
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  console.log('Screenshots saved to:', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 200));
  process.exit(1);
});
