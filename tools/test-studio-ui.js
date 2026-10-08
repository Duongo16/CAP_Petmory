const { petWithPhotos, passPhotoStep } = require('./lib/made-to-order');

let PET_ID = '';
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
  const made = await (await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Studio test' },
  })).json();
  // Hang tuy bien can mot be du anh (muc 7).
  PET_ID = await petWithPhotos(made.accessToken, 4, 'Be studio');
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', EMAIL);
  await page.fill('input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 20000 });
}

async function openStudio(page) {
  await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.drawer .tab', { timeout: 40000 });
}

/** Cho khung ve ba chieu hien ra sau khi da dung mau. */
async function waitStage(page) {
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

    res.push(check('All five tabs are shown', (await page.locator('.tab').count()) === 5));
    const order = await page.locator('.tab').evaluateAll((all) => all.map((b) => b.dataset.step).join(','));
    res.push(check('The steps run photos, model, colour, stand, finish',
      order === 'PHOTOS,MODEL,COLOR,STAND,FINISH', order));
    res.push(check('The studio opens on the pet photo step', (await tabOpen(page)) === 1
      && (await page.locator('.tab[data-step="PHOTOS"]').getAttribute('aria-selected')) === 'true'));
    res.push(check('Later steps are locked until a model is built',
      (await page.locator('.tab[data-step="MODEL"]').isDisabled())
        && (await page.locator('.tab[data-step="FINISH"]').isDisabled())
        && (await page.locator('.drawer-foot .tw-btn-primary').isDisabled())));

    // Buoc mot: chon be co anh roi dung mau tu anh, studio tu sang buoc chon mau.
    await passPhotoStep(page, PET_ID);
    res.push(check('Building from the photo opens the model step', (await tabOpen(page)) === 2));
    res.push(check('Later steps open once a model is built',
      !(await page.locator('.tab[data-step="FINISH"]').isDisabled())));
    await waitStage(page);

    const overflow = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    res.push(check('The workbench fits on one screen without page scroll', overflow <= 2, `${overflow}px extra`));

    const countModel = await page.locator('.model').count();
    res.push(check('The model tab lists the base models', countModel > 0, `${countModel} models`));
    const codes = await page.locator('.model[data-model]').evaluateAll((all) => all.map((b) => b.dataset.model));
    res.push(check('The retired felted variants are gone from the list',
      codes.length > 0 && !codes.some((c) => c.startsWith('F-'))));
    await page.locator('.model').last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const brokenThumbs = await page.locator('.model-thumb').evaluateAll((all) =>
      all.filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute('src')));
    res.push(check('Every model card shows its picture', brokenThumbs.length === 0, brokenThumbs.join(', ')));
    // Mau nen tu dung la CC0 nen khong co dong ghi cong; kiem tren mot mau CC-BY.
    await page.locator('.model[data-model="DOG-GOLDEN"]').click();
    await page.waitForSelector('.credit', { timeout: 10000 });
    const creditText = (await page.locator('.credit').innerText()).trim();
    res.push(check('The chosen model credits its author and licence',
      /CC0|CC-BY/.test(creditText) && (await page.locator('.credit a').getAttribute('href'))?.startsWith('https://'),
      creditText));
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
    res.push(check('The next button opens the yarn tab', (await tabOpen(page)) === 3));
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

    // --- Tab 4: engraving with a live tag ---
    await page.locator('.tab[data-step="STAND"]').click();
    await page.waitForTimeout(400);
    await page.fill('input[formcontrolname="engravedName"]', 'Mun');
    await page.waitForTimeout(200);
    res.push(check('The wooden tag shows the engraved name live',
      (await page.locator('.tag-name').innerText()).trim() === 'Mun'));
    res.push(check('The design name is filled from the model',
      (await page.locator('input[formcontrolname="name"]').inputValue()).length > 0));
    await page.screenshot({ path: path.join(OUT, 'studio-3-engrave.png') });

    // --- The display stand on the same tab ---
    res.push(check('No stand is chosen by default, so nothing is added to the price',
      (await page.locator('.base.on[data-base="BASE-NONE"]').count()) === 1));
    await page.locator('.angle').nth(1).click();
    await page.waitForTimeout(700);
    const beforeStand = await fingerprint(page);
    await page.locator('.base[data-base="BASE-ROUND"]').click();
    await page.fill('input[formcontrolname="memorialDate"]', '2019-05-20');
    await page.waitForTimeout(900);
    res.push(check('Choosing a round stand draws it under the plush', (await fingerprint(page)) !== beforeStand));
    res.push(check('With a stand the name tag preview gives way to the stand',
      (await page.locator('.tag-preview').count()) === 0));
    res.push(check('Wood colours are offered', (await page.locator('.tone').count()) === 6));
    const beforeTone = await fingerprint(page);
    await page.locator('.tone').nth(1).click();
    await page.waitForTimeout(700);
    res.push(check('Changing the wood colour repaints the stand', (await fingerprint(page)) !== beforeTone));
    for (const code of ['FLOWERS', 'HEART', 'YARN_BALL', 'MUSHROOM']) {
      await page.locator(`.decor[data-decor="${code}"]`).click();
    }
    res.push(check('At most four decorations fit on the stand',
      await page.locator('.decor[data-decor="BONE"]').isDisabled()));
    await page.locator('.angle').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'studio-3b-stand.png') });

    // --- Quay lai buoc anh: be da chon tu dau van con, du anh ---
    await page.locator('.tab[data-step="PHOTOS"]').click();
    await page.waitForSelector('#studio-photo-need.ok', { timeout: 20000 });
    res.push(check('The pet picked in step one stays chosen',
      (await page.locator('#studio-pet').inputValue()) === PET_ID));

    // --- Tab 5: wrap up, photos are taken by themselves ---
    await page.locator('.tab[data-step="FINISH"]').click();
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
    res.push(check('The stand price is shown as its own line',
      (await page.locator('.base-line').innerText()).includes('120.000')));
    const extra = await page.evaluate(() => document.scrollingElement.scrollHeight - window.innerHeight);
    res.push(check('The last tab still fits on one screen', extra <= 2, `${extra}px extra`));
    await page.screenshot({ path: path.join(OUT, 'studio-4-finish.png') });

    // --- Save, then the cart line carries the stand at the server price ---
    await page.locator('.drawer-foot .tw-btn-secondary').click();
    await page.waitForSelector('.note.ok', { timeout: 40000 });
    res.push(check('After saving, the studio points to My designs',
      (await page.locator('.note.ok a[href="/designs"]').count()) === 1));
    const token = await page.evaluate(() => localStorage.getItem('petmory.access'));
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    const designs = await (await page.request.get(`${API}/designs`, auth)).json();
    const stand = designs[0]?.stand;
    res.push(check('The server stores the stand choice',
      stand?.baseCode === 'BASE-ROUND' && stand?.tone === 'WALNUT' && stand?.decorations?.length === 4,
      JSON.stringify(stand)));

    await page.locator('.drawer .tab[data-step="STAND"]').click();
    await page.locator('.tone').nth(0).click();
    await page.locator('.drawer .tab[data-step="FINISH"]').click();
    await page.waitForTimeout(400);
    // Doi de sau khi luu thi bao chua luu, nhung nut van bam duoc va se tu luu lai.
    res.push(check('Changing the stand after saving says it is not saved yet, and the button stays clickable',
      (await page.locator('.note.warn').count()) === 1
        && !(await page.locator('#studio-add-cart').isDisabled())));
    await page.locator('.drawer-foot .tw-btn-secondary').click();
    await page.waitForFunction(() => !document.querySelector('.note.warn'), null, { timeout: 40000 });
    res.push(check('Saving a second time works, the six photos upload side by side',
      (await page.locator('.note.danger').count()) === 0));
    await page.locator('.drawer-foot .tw-btn-primary').click();
    await page.waitForSelector('a[href="/cart"] [role="status"]', { timeout: 20000 });
    const cart = await (await page.request.get(`${API}/cart`, auth)).json();
    const line = (cart.items ?? cart.lines ?? [])[0];
    const quote = (await page.locator('.quote-price').innerText()).replace(/[^0-9]/g, '');
    const unit = String(line?.unitPrice?.$numberDecimal ?? line?.unitPrice ?? '').split('.')[0];
    res.push(check('The cart line names the stand', line?.displayBaseCode === 'BASE-ROUND', line?.displayBaseName));
    // Gia tren man hinh da gom tien de, nen phai khop dung don gia may chu chot vao dong.
    res.push(check('The screen price already includes the stand and matches the line',
      BigInt(unit || '0') === BigInt(quote || '0'), `${quote} = ${unit}`));

    // --- A draft saved on a retired model opens on its replacement ---
    const retired = await page.request.post(`${API}/designs`, {
      ...auth,
      data: { name: 'Ban cu dang len', modelCode: 'F-SHIBA-SOFT' },
    });
    const retiredId = (await retired.json())._id;
    await page.goto(`${WEB}/studio?draft=${retiredId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.name-chip', { timeout: 40000 });
    await page.waitForTimeout(1500);
    const chipText = (await page.locator('.name-chip').innerText()).trim();
    res.push(check('A design on a retired felted model reopens on the matching real model',
      chipText === 'Shiba Inu', chipText));
    await page.request.delete(`${API}/designs/${retiredId}`, auth);

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
