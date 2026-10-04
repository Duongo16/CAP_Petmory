/**
 * Chup anh the cho tung mau 3D bang chinh khung xem cua trang tuy bien, de
 * anh tren the giong het mau ma khach se thay, ke ca chat len.
 *
 * Run: node tools/render-model-thumbs.js            (anh the, goc cheo)
 *      node tools/render-model-thumbs.js --front <thu-muc>   (goc truoc, de kiem huong)
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const os = require('os');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const EMAIL = 'thumbs@petmory.local';
const PASSWORD = 'Password@123';
const SIZE = 320;

async function run() {
  const front = process.argv.includes('--front');
  const outDir = front
    ? path.resolve(process.argv[process.argv.indexOf('--front') + 1] || 'front-check')
    : path.join(__dirname, '..', 'apps', 'web', 'public', 'models', 'thumbs');
  fs.mkdirSync(outDir, { recursive: true });
  // Ghi vao thu muc tam truoc. Ghi thang vao thu muc cua trang web thi may chu
  // phat trien thay tep moi va tai lai trang giua chung, lam mat mau dang chon.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-thumbs-'));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.request.post(`${API}/auth/register`, { data: { email: EMAIL, password: PASSWORD, fullName: 'Thumbs' } });
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', EMAIL);
  await page.fill('input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 20000 });
  await page.goto(`${WEB}/studio`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.model[data-model]', { timeout: 40000 });
  await page.waitForTimeout(2000);

  const codes = await page.locator('.model[data-model]').evaluateAll((all) => all.map((b) => b.dataset.model));
  for (const code of codes) {
    await page.locator(`.model[data-model="${code}"]`).click();
    await page.waitForTimeout(2600);
    // Tat tu xoay roi chon goc, de anh nao cung cung mot huong.
    const rotating = page.locator('.stage-tools .round-button[aria-pressed="true"]');
    if (await rotating.count()) {
      await rotating.first().click();
    }
    await page.locator('.angle').nth(front ? 1 : 0).click();
    await page.waitForTimeout(900);
    const data = await page.evaluate(() => document.querySelector('pm-viewer-3d canvas').toDataURL('image/png'));
    const raw = Buffer.from(data.split(',')[1], 'base64');
    const trimmed = await sharp(raw).trim({ threshold: 12 }).toBuffer();
    const meta = await sharp(trimmed).metadata();
    const edge = Math.round(Math.max(meta.width, meta.height) * 1.12);
    const background = await sharp(raw).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer();
    const bg = { r: background[0], g: background[1], b: background[2], alpha: 1 };
    const out = await sharp(trimmed)
      .extend({
        top: Math.floor((edge - meta.height) / 2),
        bottom: Math.ceil((edge - meta.height) / 2),
        left: Math.floor((edge - meta.width) / 2),
        right: Math.ceil((edge - meta.width) / 2),
        background: bg,
      })
      .resize(SIZE, SIZE);
    const file = path.join(work, front ? `${code}.png` : `${code}.webp`);
    await (front ? out.png() : out.webp({ quality: 82 })).toFile(file);
    console.log('saved', path.basename(file));
  }
  await browser.close();
  for (const name of fs.readdirSync(work)) {
    fs.copyFileSync(path.join(work, name), path.join(outDir, name));
  }
  fs.rmSync(work, { recursive: true, force: true });
}

run().catch((e) => {
  console.error('Loi:', e.message.slice(0, 300));
  process.exit(1);
});
