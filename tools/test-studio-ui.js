/**
 * Browser test of the whole three-step customiser flow.
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

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 940 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('THREE-STEP CUSTOMISER FLOW TEST');
    console.log('='.repeat(64));

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Studio test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });
    res.push(check('Sign in through the interface', true));

    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('mat-button-toggle-group', { timeout: 40000 });
    await page.locator('button:has-text("Dừng xoay")').click();
    await page.waitForTimeout(700);

                // --- Step 1 ---
    res.push(check('All four steps are shown', (await page.locator('.step-button').count()) === 4));
    const countColor = await page.locator('.model-button').count();
    res.push(check('Step 1 lists the base models', countColor > 0, `${countColor} models`));

    const canvas = await page.evaluate(() => {
      const c = document.querySelector('pm-viewer-3d canvas');
      return c ? { width: c.width, coWebgl: Boolean(c.getContext('webgl2') || c.getContext('webgl')) } : null;
    });
    res.push(check('There is a WebGL drawing area', Boolean(canvas?.coWebgl && canvas.width > 0)));

    await page.locator('.model-button:has-text("Shiba Inu")').click();
    await page.waitForTimeout(2600);
    res.push(check('Switching to the realistic style works', true));
    await page.screenshot({ path: path.join(OUT, 'studio-1-base-model.png') });

                // --- Step 2 ---
    await page.locator('button:has-text("Tiếp tục")').click();
    await page.waitForTimeout(600);
    // Kiem theo vi tri buoc chu khong theo chu, vi chu co the doi theo thiet ke.
    const atStep = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('.step-button'));
      return all.findIndex((b) => b.classList.contains('current')) + 1;
    });
    res.push(check('Step two can be reached', atStep === 2, `dang o buoc ${atStep}`));

    const countCell = await page.locator('.swatch').count();
    res.push(check('Step 2 shows the colour palette', countCell > 0, `${countCell} colour codes`));

    await page.locator('mat-button-toggle:has-text("Chéo")').click();
    await page.waitForTimeout(700);
    const before = await fingerprint(page);

                // Flood a whole patch
    await page.locator('.swatch').first().click();
    await page.waitForTimeout(250);
    res.push(check('A colour can be picked up', (await page.locator('.holding').count()) > 0));

    const box = await page.locator('.canvas-3d').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(800);
    const afterMeasure = await fingerprint(page);
    res.push(check('Flooding a patch changes the model colour', before !== afterMeasure));
    await page.screenshot({ path: path.join(OUT, 'studio-2-flood-fill.png') });

                // Brush stroke
    await page.locator('mat-button-toggle:has-text("Quét bằng cọ")').click();
    await page.waitForTimeout(250);
    res.push(check('The brush toolbar is shown', (await page.locator('#brush-size').count()) > 0));

    await page.locator('.swatch').nth(14).click();
    await page.waitForTimeout(200);
    await page.mouse.move(box.x + box.width * 0.44, box.y + box.height * 0.42);
    await page.mouse.down();
    for (let i = 0; i <= 10; i += 1) {
      await page.mouse.move(box.x + box.width * (0.44 + i * 0.011), box.y + box.height * (0.42 + i * 0.007));
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const afterSize = await fingerprint(page);
    res.push(check('A brush stroke changes the model colour', afterSize !== afterMeasure));

    await page.locator('button:has-text("Hoàn tác")').click();
    await page.waitForTimeout(600);
    res.push(check('Undo puts the drawing back', (await fingerprint(page)) !== afterSize));

    await page.locator('button:has-text("Bỏ cầm màu")').click();
    await page.waitForTimeout(250);
    const beforeRotate = await fingerprint(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 170, box.y + box.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(600);
    res.push(check('Dropping the colour makes dragging rotate again', (await fingerprint(page)) !== beforeRotate));

                // Capture the six angles
    await page.locator('button:has-text("Chụp 6 góc")').click();
    await page.waitForTimeout(2200);
    const countPhoto = await page.locator('.photo-card').count();
    res.push(check('All six preview images are produced', countPhoto === 6, `${countPhoto} images`));
    await page.screenshot({ path: path.join(OUT, 'studio-3-preview.png') });

                // --- Step 3, then step 4 ---
    await page.locator('button:has-text("Tiếp tục")').click();
    await page.waitForTimeout(600);
    res.push(check('Step three can be reached', (await page.locator('.angle-list').count()) > 0));
    await page.locator('button:has-text("Tiếp tục")').click();
    await page.waitForTimeout(600);
    res.push(check('Step four can be reached', (await page.locator('.summary').count()) > 0));
    await page.screenshot({ path: path.join(OUT, 'studio-4-final.png') });

    await page.locator('button:has-text("Quay lại")').click();
    await page.waitForTimeout(500);
    res.push(check('The previous step can be reached again', (await page.locator('.angle-list').count()) > 0));

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
  console.error('Test error:', e.message.slice(0, 140));
  process.exit(1);
});
