/**
 * Browser test: the pet photos screen and the chat panel.
 * Run: node tools/test-photos-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const TEMP = path.join(OUT, 'temp');
const EMAIL = `gd.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

function testSvg(edge) {
  return Buffer.from(`<svg width="${edge}" height="${edge}">
    <defs><radialGradient id="g"><stop offset="0%" stop-color="#d8c9a8"/><stop offset="100%" stop-color="#6b5b3e"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <ellipse cx="${edge * 0.5}" cy="${edge * 0.55}" rx="${edge * 0.3}" ry="${edge * 0.26}" fill="#c98b4b"/>
    <circle cx="${edge * 0.4}" cy="${edge * 0.48}" r="${edge * 0.035}" fill="#1a1a1a"/>
    <circle cx="${edge * 0.6}" cy="${edge * 0.48}" r="${edge * 0.035}" fill="#1a1a1a"/>
    <circle cx="${edge * 0.415}" cy="${edge * 0.465}" r="${edge * 0.012}" fill="#ffffff"/>
    <circle cx="${edge * 0.615}" cy="${edge * 0.465}" r="${edge * 0.012}" fill="#ffffff"/>
    <ellipse cx="${edge * 0.5}" cy="${edge * 0.6}" rx="${edge * 0.045}" ry="${edge * 0.032}" fill="#2b1b12"/>
  </svg>`);
}

async function generatePhoto(name, edge, degrade) {
  const should = await sharp(testSvg(edge)).png().toBuffer();
  const many = await sharp({
    create: { width: edge, height: edge, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 26 } },
  }).png().toBuffer();
  let photo = sharp(should).composite([{ input: many, blend: 'overlay' }]);
  if (degrade) {
    photo = sharp(await photo.png().toBuffer()).blur(3.2).linear(0.45, -6);
  }
  const push = path.join(TEMP, name);
  await photo.png().toFile(push);
  return push;
}

async function run() {
  fs.mkdirSync(TEMP, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('PHOTO SCREEN AND ASSISTANT UI TEST');
    console.log('='.repeat(64));

    await page.request.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'UI test' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 20000 });

                // --- Create a pet, then open the photos screen ---
    await page.goto(`${WEB}/pets`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="name"]', 'Mun');
    await page.fill('input[formcontrolname="kind"]', 'Meo');
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('.pet-card', { timeout: 15000 });
    res.push(check('A pet profile can be created', true));

    await page.locator('a:has-text("Ảnh của bé")').first().click();
                // The development server still has to compile this route the first time, so allow longer.
    await page.waitForURL(/\/photos$/, { timeout: 40000 });
    await page.waitForSelector('.angle-slot', { timeout: 40000 });
    res.push(check('The photos screen opens', (await page.locator('.angle-slot').count()) === 6));
    res.push(check('All four required angles are shown', (await page.locator('.asterisk').count()) === 4));

    const progressFirst = (await page.locator('.angle-count').innerText()).trim();
    res.push(check('It starts with no angle filled', progressFirst === '0/4', progressFirst));
    await page.screenshot({ path: path.join(OUT, 'photos-1-empty.png') });

                // --- Upload a good photo for the front angle ---
    const photoGood = await generatePhoto('good.png', 1300, false);
    await page.setInputFiles('#file-FRONT', photoGood);
    await page.waitForSelector('.angle-slot:first-child img', { timeout: 20000 });
    const nhan1 = (await page.locator('.angle-slot').first().locator('.label').innerText()).trim();
    res.push(check('A good photo is scored as good', nhan1 === 'Ảnh tốt', nhan1));
    res.push(check('Progress rises to 1/4', (await page.locator('.angle-count').innerText()).trim() === '1/4'));
    res.push(check('A good photo offers no restore button',
      (await page.locator('.angle-slot').first().locator('button:has-text("Phục hồi ảnh")').count()) === 0));

                // --- Upload a poor photo for the left angle ---
    const poorImage = await generatePhoto('poor.png', 520, true);
    await page.setInputFiles('#file-LEFT_SIDE', poorImage);
    const badSlot = page.locator('.angle-slot').nth(1);
    await badSlot.locator('img').waitFor({ timeout: 20000 });
    const nhan2 = (await badSlot.locator('.label').innerText()).trim();
    res.push(check('A poor photo is scored as not usable', nhan2 === 'Chưa dùng được', nhan2));
    res.push(check('A specific warning is shown', (await badSlot.locator('.warning li').count()) >= 2,
      (await badSlot.locator('.warning li').allInnerTexts()).join(' | ')));
    await page.screenshot({ path: path.join(OUT, 'photos-2-uploaded.png') });

                // --- Restoration ---
    await badSlot.locator('button:has-text("Phục hồi ảnh")').click();
    await page.waitForSelector('.compare-dialog', { timeout: 30000 });
    const countPhotoCompare = await page.locator('.compare-dialog figure img').count();
    res.push(check('The before and after comparison opens', countPhotoCompare === 2, `${countPhotoCompare} photos`));
    const caption = (await page.locator('.compare-dialog .spec').allInnerTexts()).map((t) => t.trim());
    // The dialog also carries a resemblance line now, so the size lines are the
    // ones that start with a digit followed by the multiplication sign.
    const sizes = caption.filter((t) => /^\d+×\d+/.test(t));
    res.push(check('The restored version is larger than the original',
      sizes.length === 2 && sizes[1].startsWith('1040'), sizes.join('  /  ')));
    res.push(check('The comparison reports how closely it still resembles the original',
      caption.some((t) => /\d+(\.\d+)?%/.test(t)), caption.join('  /  ')));
    await page.screenshot({ path: path.join(OUT, 'photos-3-compare.png') });

                // --- Keeping the original discards the restored version ---
    await page.locator('button:has-text("Giữ ảnh gốc")').click();
    await page.waitForSelector('.compare-dialog', { state: 'detached', timeout: 15000 });
    res.push(check('Keeping the original closes the comparison', true));
    res.push(check('Keeping the original leaves the restore button in place',
      (await badSlot.locator('button:has-text("Phục hồi ảnh")').count()) === 1));

                // --- Restore again, then accept it ---
    await badSlot.locator('button:has-text("Phục hồi ảnh")').click();
    await page.waitForSelector('.compare-dialog', { timeout: 30000 });
    await page.locator('button:has-text("Dùng bản phục hồi")').click();
    await page.waitForSelector('.compare-dialog', { state: 'detached', timeout: 15000 });
    await badSlot.locator('.in-use').waitFor({ timeout: 10000 });
    res.push(check('Accepting marks the restored version as in use', true));

                // --- Chat panel ---
    await page.locator('.open-button').click();
    await page.waitForSelector('#assistant-panel', { timeout: 10000 });
    res.push(check('The chat panel opens', true));
    await page.waitForSelector('.bubble', { timeout: 10000 });
    res.push(check('There is an opening greeting', (await page.locator('.bubble').count()) === 1));
    res.push(check('There are suggestion chips', (await page.locator('.chip').count()) >= 3));

    await page.locator('.chip:has-text("Giá bao nhiêu?")').click();
    await page.waitForFunction(() => document.querySelectorAll('.bubble').length >= 3, null,
      { timeout: 15000 });
    const answerPrice = (await page.locator('.bubble').last().innerText());
    res.push(check('The price answer carries a real amount', answerPrice.includes('450.000'),
      answerPrice.split('\n')[1] ?? ''));
    res.push(check('There is a button through to the related page', (await page.locator('.goto-button').count()) >= 1));

    await page.fill('#assistant-input', 'bé nhà mình đã mất rồi');
    await page.locator('.send-button').click();
    await page.waitForFunction(() => document.querySelectorAll('.bubble').length >= 5, null,
      { timeout: 15000 });
    const answerFace = await page.locator('.bubble').last().innerText();
    res.push(check('The memorial question is answered properly', answerFace.includes('rất tiếc'),
      answerFace.slice(0, 40)));
    await page.screenshot({ path: path.join(OUT, 'photos-4-assistant.png') });

    await page.fill('#assistant-input', 'xyz khong lien quan gi het');
    await page.locator('.send-button').click();
    await page.waitForFunction(() => document.querySelectorAll('.bubble').length >= 7, null,
      { timeout: 15000 });
    const fallbackAnswer = await page.locator('.bubble').last().innerText();
    res.push(check('An off-topic question offers a human',
      fallbackAnswer.includes('tư vấn viên'), fallbackAnswer.slice(0, 40)));

                // --- Permissions: another owner's pet photos cannot be viewed ---
    const currentUrl = page.url();
    const petId = currentUrl.split('/').slice(-2)[0];
    const otherUser = await page.request.post(`${API}/auth/register`, {
      data: { email: `x.${Date.now()}@petmory.local`, password: PASSWORD, fullName: 'Nguoi khac' },
    });
    const otherToken = (await otherUser.json()).accessToken;
    const steal = await page.request.get(`${API}/pet-photos?pet=${petId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    res.push(check('Another user cannot read the photo list', steal.status() === 404, String(steal.status())));

    const realErrors = error.filter((l) => !/favicon/i.test(l));
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
    fs.rmSync(TEMP, { recursive: true, force: true });
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 900));
  process.exit(1);
});
