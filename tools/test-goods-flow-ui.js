/**
 * Kiem thu giao dien mua hang co san tu dau den cuoi: them vao gio, tang so
 * luong vuot kho, dat hang khi kho vua giam, huy don bang hai lan bam, va trang
 * don cua nhom Quan ly hien dung loai don cung canh bao can xu ly.
 *
 * Bai tu tao mot mon hang rieng va an no di khi xong.
 *
 * Chay: node tools/test-goods-flow-ui.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const WEB = process.env.PETMORY_WEB ?? 'http://localhost:4200';
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const WEBHOOK_KEY = process.env.PETMORY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const STAMP = Date.now();
const CODE = `UI-${STAMP}`;
const SKU = 'UI-A';
const PASSWORD = 'Password@123';
const DELIVERY = [
  ['#checkout-name', 'Khach giao dien'],
  ['#checkout-phone', '0912345678'],
  ['#checkout-address', '12 Duong Thu'],
  ['#checkout-province', 'Ha Noi'],
];

fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
let passed = 0;
function ok(name, good, note = '') {
  if (good) {
    passed += 1;
  } else {
    failed += 1;
  }
  console.log(`  ${good ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function signIn(page, email, password) {
  await page.goto(`${WEB}/login`);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type=submit]');
}

async function fillDelivery(page) {
  for (const [box, value] of DELIVERY) {
    await page.fill(box, value);
  }
}

async function quantityShown(page) {
  return (await page.locator('.line .line-stepper-val').first().innerText()).trim();
}

(async () => {
  console.log('GIAO DIEN MUA HANG CO SAN');
  console.log('='.repeat(64));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const req = ctx.request;
  const errors = [];

  const login = await req.post(`${API}/auth/login`, {
    data: { email: 'quanly@petmory.local', password: 'Petmory@2026' },
  });
  const boss = (await login.json()).accessToken;
  const asBoss = { authorization: `Bearer ${boss}` };
  const groups = await (await req.get(`${API}/goods/categories`)).json();
  const made = await req.post(`${API}/admin/goods`, {
    headers: asBoss,
    data: {
      code: CODE,
      name: `Vong thu giao dien ${STAMP}`,
      category: groups[0]._id,
      optionNames: ['Loai'],
      deliveryDays: 2,
      variant: [{ sku: SKU, optionValues: ['A'], price: '45000', stock: 2 }],
    },
  });
  ok('Tao duoc mon hang thu nghiem', made.status() === 201, String(made.status()));

  const email = `ui.${STAMP}@petmory.local`;
  await req.post(`${API}/auth/register`, {
    data: { email, password: PASSWORD, fullName: 'Khach giao dien' },
  });

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await signIn(page, email, PASSWORD);
  await page.waitForURL('**/home');

  // --- Them vao gio tu popup chi tiet trong cua hang ---
  await page.goto(`${WEB}/shop?tab=ready&goods=${CODE}`, { waitUntil: 'networkidle' });
  await page.locator('.pm-dialog pm-goods-detail-page button', { hasText: /Thêm vào giỏ/ }).first().click();
  await page.locator('header a[href="/cart"] [role=status]').waitFor({ timeout: 15000 }).catch(() => undefined);
  ok('Them tu cua so chi tiet thi bo dem gio hang len mot',
    (await page.locator('header a[href="/cart"] [role=status]').innerText().catch(() => '')).trim() === '1');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pm-dialog', { state: 'detached', timeout: 15000 });
  ok('Bam Esc thi cua so chi tiet dong va dia chi bo ma mon',
    !new URL(page.url()).searchParams.has('goods'), page.url());

  // --- Tang so luong trong gio vuot kho ---
  await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.line');
  const more = page.locator('.line .line-stepper button:has-text("+")');
  await more.click();
  await page.waitForTimeout(800);
  await more.click();
  await page.waitForTimeout(800);
  ok('Tang so luong vuot kho thi dung lai o so dang co', (await quantityShown(page)) === '2',
    await quantityShown(page));
  const alerts = await page.locator('[role=alert]').allInnerTexts();
  ok('Gio hang bao ro la kho khong du, khong vo ca trang',
    alerts.some((one) => one.includes('không còn đủ')) && (await page.locator('.line').count()) === 1,
    alerts.join(' | '));
  await page.screenshot({ path: path.join(OUT, 'goods-flow-1-cart.png') });

  // --- Kho giam trong luc khach dang o trang dat hang ---
  await req.patch(`${API}/admin/goods/${CODE}/stock/${SKU}`, {
    headers: asBoss,
    data: { delta: -1, note: 'Kiem thu giao dien' },
  });
  await page.goto(`${WEB}/checkout`, { waitUntil: 'networkidle' });
  await fillDelivery(page);
  await page.click('button[type=submit][form=checkout-form]');
  await page.waitForTimeout(1500);
  const said = await page.locator('.form-error').allInnerTexts();
  ok('Dat hang khi kho vua giam thi bao ro va o lai trang dat hang',
    new URL(page.url()).pathname === '/checkout' && said.some((one) => one.includes('Giỏ hàng vẫn được giữ')),
    said.join(' | '));
  await page.screenshot({ path: path.join(OUT, 'goods-flow-2-checkout.png') });

  await page.goto(`${WEB}/cart`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.line');
  ok('Gio hang van con sau lan dat khong thanh', (await page.locator('.line').count()) === 1);
  await page.locator('.line .line-stepper button:has-text("−")').click();
  await page.waitForTimeout(800);

  await page.goto(`${WEB}/checkout`, { waitUntil: 'networkidle' });
  await fillDelivery(page);
  await page.click('button[type=submit][form=checkout-form]');
  await page.waitForURL('**/payments/**', { timeout: 15000 }).catch(() => undefined);
  const orderCode = new URL(page.url()).pathname.split('/').pop();
  ok('Sua so luong roi dat lai thi duoc', /^PM\d+$/.test(orderCode), orderCode);

  // --- Don cua toi: the don hang co san va huy bang hai lan bam ---
  await page.goto(`${WEB}/orders`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.order');
  const card = (await page.locator('.order').first().innerText()).replace(/\s+/g, ' ');
  ok('The don ghi la hang co san, khong co bao hanh len',
    card.includes('Hàng có sẵn') && !card.includes('Bảo hành'), card.slice(0, 120));
  ok('Tien do don hang co san chi co ba chang',
    (await page.locator('.order').first().locator('.track-step').count()) === 3);

  const cancel = page.locator('.deed-cancel').first();
  await cancel.click();
  await page.waitForTimeout(300);
  ok('Bam huy lan dau chi hoi lai', (await cancel.innerText()).trim() === 'Bấm lần nữa để huỷ',
    (await cancel.innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'goods-flow-3-orders.png') });
  await cancel.click();
  await page.waitForTimeout(1500);
  ok('Bam lan thu hai thi don duoc huy', (await page.locator('.deed-cancel').count()) === 0);

  // --- Tien ve cho don da huy: nhom Quan ly thay canh bao ---
  await req.post(`${API}/payments/webhook`, {
    headers: { authorization: `Apikey ${WEBHOOK_KEY}` },
    data: { id: `ui-late-${STAMP}`, transferAmount: 45000, content: `CT ${orderCode}` },
  });
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  admin.on('pageerror', (e) => errors.push(e.message));
  await signIn(admin, 'quanly@petmory.local', 'Petmory@2026');
  await admin.waitForTimeout(2500);
  await admin.goto(`${WEB}/admin/orders/${orderCode}`, { waitUntil: 'networkidle' });
  await admin.waitForSelector('.header-note');
  ok('Trang don cua Quan ly ghi dung la don hang co san',
    (await admin.locator('.header-note').innerText()).includes('có sẵn'));
  ok('Tien ve cho don da huy hien canh bao can xu ly', (await admin.locator('.attention').count()) === 1);
  await admin.screenshot({ path: path.join(OUT, 'goods-flow-4-admin.png') });

  await req.delete(`${API}/admin/goods/${CODE}`, { headers: asBoss });
  ok('Khong co loi nao trong trang', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
