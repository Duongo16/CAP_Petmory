/**
 * Takes a picture of one or more screens, signed in, and reports any breakage.
 *
 * Every screen rebuilt against the design gets looked at rather than assumed,
 * and this is the one command for doing that. It waits for the development
 * server to finish compiling first, because while it is rebuilding an error
 * overlay covers the page and every picture comes out of that instead.
 *
 * Run: node tools/shot.js /products /cart
 *      node tools/shot.js --internal /admin/orders
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = process.env.PETMORY_WEB ?? 'http://localhost:4200';
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';

const INTERNAL = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

/** Waits until the development server has finished compiling. */
async function settle(page) {
  for (let i = 0; i < 90; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 90 giay');
}

async function run() {
  const args = process.argv.slice(2);
  const internal = args.includes('--internal');
  /*
   * Duong dan co the viet khong kem dau gach dau.
   * Tren Windows, vo Git Bash tu doi mot doi so bat dau bang dau gach thanh
   * duong dan o dia, nen goi la "products" thay vi "/products" moi chay duoc.
   */
  const routes = args
    .filter((a) => !a.startsWith('--'))
    .map((a) => (a.startsWith('/') ? a : `/${a}`));
  if (routes.length === 0) {
    console.log('Hay cho biet duong dan, vi du: node tools/shot.js /products');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e).slice(0, 160)));
  page.on('requestfailed', (q) => {
    const why = String(q.failure() && q.failure().errorText);
    if (why.includes('BLOCKED')) {
      broken.push(`${why}  ${q.url().slice(0, 100)}`);
    }
  });

  let who = INTERNAL;
  if (!internal) {
    const email = `xem.${Date.now()}@petmory.local`;
    await page.request.post(`${API}/auth/register`, {
      data: { email, password: 'Password@123', fullName: 'Nguoi xem' },
    });
    who = { email, password: 'Password@123' };
  }

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', who.email);
  await page.fill('#login-password', who.password);
  await page.click('.submit');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

  console.log('SCREENSHOTS');
  console.log('='.repeat(64));

  for (const route of routes) {
    const name = route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'home';
    await page.goto(WEB + route, { waitUntil: 'networkidle', timeout: 60000 });
    await settle(page);
    await page.waitForTimeout(2200);
    const where = path.join(OUT, `view-${name}.png`);
    await page.screenshot({ path: where, fullPage: true });
    const blank = await page.evaluate(() =>
      Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length);
    console.log(`  ${route.padEnd(36)} ${blank === 0 ? 'anh deu tai duoc' : blank + ' anh hong'}`);
  }

  await browser.close();
  console.log('-'.repeat(64));
  console.log(broken.length === 0 ? 'Khong co loi nao trong trang' : `Loi: ${broken.slice(0, 3).join(' | ')}`);
  console.log(`Anh luu tai ${OUT}`);
  process.exit(broken.length === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Chup anh that bai:', e.message);
  process.exit(1);
});
