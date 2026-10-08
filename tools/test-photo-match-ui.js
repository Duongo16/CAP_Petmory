const { passPhotoStep, waitOverlayGone } = require('./lib/made-to-order');
/**
 * Kiem thu luong tuy bien bat dau tu anh cua be (SOW muc 5, 15).
 *
 * Studio mo o buoc chon mau va khong khoa buoc nao. Dung mau tu anh la tuy chon,
 * nam trong mot khung nho dau buoc chon mau. Khach chon be, he thong xem anh de
 * nhan ra loai, tu the va mau long, chon san mau gan giong nhat va van o buoc
 * chon mau. Loai chua co mau thi dung mau mac dinh va noi ro dieu do. Be chua
 * co anh thi hien loi nhac tai anh, may chu cung tu choi.
 * Run: node tools/test-photo-match-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');
const sharp = require('sharp');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = `match.${Date.now()}@petmory.local`;
const PASSWORD = 'Password@123';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const PICTURES = path.join(__dirname, '..', 'apps', 'web', 'public');
const BTN_MATCH = '#studio-match';
const MODEL_NAME = '#studio-match-model';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Tao mot be va tai len mot anh lay tu thu muc anh cua trang web. */
async function petWithPicture(api, auth, name, kind, file) {
  const pet = await (await api.post(`${API}/pets`, { headers: auth, data: { name, kind } })).json();
  const buffer = await sharp(path.join(PICTURES, file))
    .resize(800, 800, { fit: 'contain', background: '#f3efe8' })
    .flatten({ background: '#f3efe8' })
    .jpeg()
    .toBuffer();
  const sent = await api.post(`${API}/pet-photos/${pet._id}`, {
    headers: auth, multipart: { file: { name: 'be.jpg', mimeType: 'image/jpeg', buffer } },
  });
  if (!sent.ok()) {
    throw new Error(`tai anh that bai ${sent.status()}`);
  }
  return pet._id;
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const api = await request.newContext();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const res = [];
  try {
    console.log('STUDIO OPTIONAL BUILD FROM PET PHOTOS TEST');
    console.log('='.repeat(64));
    const made = await (await api.post(`${API}/auth/register`, {
      data: { email: EMAIL, password: PASSWORD, fullName: 'Dung mau test' },
    })).json();
    const auth = { Authorization: `Bearer ${made.accessToken}` };

    // May chu: be chua co anh thi khong dung mau duoc.
    const bare = await (await api.post(`${API}/pets`, { headers: auth, data: { name: 'Chua anh', kind: 'DOG' } })).json();
    const refused = await api.post(`${API}/design-suggestions/from-photo`, { headers: auth, data: { petId: bare._id } });
    res.push(check('A pet with no photo is refused', refused.status() === 400 && (await refused.json()).code === 'NEED_PHOTOS',
      String(refused.status())));

    const catId = await petWithPicture(api, auth, 'Miu', 'CAT', 'models/thumbs/BASE-CAT-LIE.webp');
    const foxId = await petWithPicture(api, auth, 'Cao', 'OTHER', 'demo/memory.png');

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', EMAIL);
    await page.fill('input[formcontrolname="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });

    // --- Studio mo o buoc chon mau, khong buoc nao bi khoa ---
    await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#studio-match-box', { timeout: 40000 });
    await waitOverlayGone(page);
    res.push(check('The studio opens on the model step',
      (await page.locator('[data-step="MODEL"]').getAttribute('aria-selected')) === 'true'));
    res.push(check('The model step comes first', (await page.locator('.tabs .tab').first().getAttribute('data-step')) === 'MODEL'));
    const tabsOpen = await page.locator('.tabs .tab').evaluateAll((all) => all.every((one) => !one.disabled));
    res.push(check('No step is locked',
      tabsOpen && !(await page.locator('.drawer-foot .tw-btn-primary').isDisabled())));
    res.push(check('The optional build-from-photos box sits in the model step', await page.locator('#studio-match-box').isVisible()));
    res.push(check('Building is locked until a pet is chosen', await page.locator(BTN_MATCH).isDisabled()));

    // --- Be chua co anh: hien loi nhac tai anh ---
    await page.selectOption('#studio-match-pet', bare._id);
    await page.waitForSelector('#studio-match-need-photo', { timeout: 20000 });
    res.push(check('A pet with no photo shows the need-photo hint', await page.locator('#studio-match-need-photo').isVisible()));
    res.push(check('Building stays locked for a pet with no photo', await page.locator(BTN_MATCH).isDisabled()));

    // --- Meo nam: nhan dung loai va tu the ---
    await passPhotoStep(page, catId);
    res.push(check('The studio stays on the model step after building',
      (await page.locator('[data-step="MODEL"]').getAttribute('aria-selected')) === 'true'));
    const found = (await page.locator('#studio-match-result').innerText()).replace(/\s+/g, ' ');
    res.push(check('The result names the species it found', found.includes('Mèo'), found.slice(0, 90)));
    res.push(check('A cat photo picks a cat model', (await page.locator(MODEL_NAME).innerText()).includes('Mèo'),
      await page.locator(MODEL_NAME).innerText()));
    res.push(check('The fur colours found are listed', (await page.locator('.match-swatches li').count()) >= 4,
      String(await page.locator('.match-swatches li').count())));
    const aiRan = (await page.locator('.match-mode').innerText()).includes('AI từ ảnh');
    const notes = page.locator('.match-notes');
    res.push(check('The notes line for the workshop shows when the AI ran',
      !aiRan || ((await notes.count()) > 0 && (await notes.innerText()).includes('Ghi chú cho xưởng:')),
      aiRan ? 'AI' : 'local estimate'));
    await page.screenshot({ path: path.join(OUT, 'photo-match-result.png') });

    const picked = await page.locator('.model.on').getAttribute('data-model');
    res.push(check('The model step has the matched model selected', (picked ?? '').startsWith('BASE-CAT'), String(picked)));
    await page.waitForTimeout(2500);
    res.push(check('The 3D stage shows the model', (await page.locator('canvas').count()) > 0));

    // --- Loai chua co mau: dung mau mac dinh va noi ro ---
    await waitOverlayGone(page);
    await page.selectOption('#studio-match-pet', foxId);
    await page.waitForSelector(`${BTN_MATCH}:not([disabled])`, { timeout: 20000 });
    await waitOverlayGone(page);
    await page.locator(BTN_MATCH).click();
    await page.waitForSelector('#studio-match-fallback', { timeout: 60000 });
    res.push(check('A species without a model falls back to the default with a note',
      (await page.locator(MODEL_NAME).innerText()).includes('Cún ngồi'),
      await page.locator(MODEL_NAME).innerText()));
    res.push(check('The studio still stays on the model step',
      (await page.locator('[data-step="MODEL"]').getAttribute('aria-selected')) === 'true'));

    res.push(check('No javascript error', errors.length === 0, errors.slice(0, 2).join(' | ')));
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
  console.error('Test error:', e.message);
  process.exit(1);
});
