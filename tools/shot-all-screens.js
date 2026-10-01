/**
 * Chup toan bo cac man hinh cua trang web o hai be rong man hinh.
 *
 * Dung de soat giao dien: nhin canh nhau thi moi thay man hinh nao lech khung,
 * lech co chu hay lech khoang cach so voi cac man con lai. Cac ma tra cuu that
 * duoc doc tu may chu chu khong viet cung, de bo anh khong hong khi du lieu
 * mau doi.
 *
 * Chay: node tools/shot-all-screens.js
 * Them ten mot be rong o cuoi de chi chup rieng be rong do.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots', 'soat-giao-dien');

const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const BUYER = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };

/** Hai be rong dai dien: mot may tinh de ban va mot dien thoai. */
const SIZES = [
  { key: 'may-tinh', width: 1440, height: 1000 },
  { key: 'dien-thoai', width: 390, height: 844 },
];

async function api(where, options = {}) {
  const answer = await fetch(`${API}${where}`, options);
  const text = await answer.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function tokenOf(who) {
  const got = await api('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(who),
  });
  return got?.accessToken ?? null;
}

/** Cac ma tra cuu that, doc tu may chu. */
async function realCodes() {
  const boss = await tokenOf(BOSS);
  const head = { headers: { authorization: `Bearer ${boss}` } };

  const products = await api('/catalog/products');
  const goods = await api('/goods');
  const orders = await api('/admin/orders?page=1', head);
  const customers = await api('/admin/customers?page=1', head);
  const diaries = await api('/diaries?page=1');

  return {
    product: products?.[0]?.code ?? '',
    goods: goods?.rows?.[0]?.code ?? '',
    order: orders?.rows?.[0]?.orderCode ?? '',
    customer: customers?.rows?.[0]?._id ?? '',
    diaryPet: diaries?.rows?.[0]?.petId ?? '',
  };
}

/** Cho trang lang di, va bo qua neu no khong bao gio lang han. */
async function settle(page) {
  await page.waitForTimeout(900);
  await page
    .waitForFunction(() => document.querySelectorAll('img').length >= 0, undefined, { timeout: 4000 })
    .catch(() => undefined);
  await page.waitForTimeout(1600);
}

async function signIn(page, who) {
  /*
   * Thoat phien cu truoc.
   *
   * Dang con phien thi duong dang nhap bi day ve trang chu, va buoc dien tai
   * khoan se cho mai mot o nhap khong bao gio hien ra.
   */
  await page.goto(WEB, { waitUntil: 'load' });
  const account = page.locator('.account-button');
  await account.waitFor({ timeout: 12000 }).catch(() => undefined);
  if ((await account.count()) > 0) {
    await account.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 }).catch(() => undefined);
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', who.email);
  await page.fill('#login-password', who.password);
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 40000 }).catch(async () => {
    await page.click('.submit');
    await page.waitForURL('**/home', { timeout: 40000 });
  });
}

async function shoot(page, where, name, folder) {
  try {
    await page.goto(`${WEB}${where}`, { waitUntil: 'networkidle', timeout: 45000 });
  } catch {
    await page.goto(`${WEB}${where}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await settle(page);
  const file = path.join(folder, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const height = await page.evaluate(() => document.body.scrollHeight);
  console.log(`  ${name.padEnd(28)} ${where.padEnd(34)} cao ${height}`);
}

async function run() {
  const only = process.argv[2];
  const sizes = only ? SIZES.filter((one) => one.key === only) : SIZES;
  fs.mkdirSync(OUT, { recursive: true });

  const code = await realCodes();
  console.log('Ma tra cuu that:', JSON.stringify(code));

  const browser = await chromium.launch();

  for (const size of sizes) {
    const folder = path.join(OUT, size.key);
    fs.mkdirSync(folder, { recursive: true });
    console.log('');
    console.log(`=== ${size.key} · ${size.width} nhan ${size.height} ===`);

    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });

    /* Nhom man hinh mo cho nguoi chua dang nhap. */
    await shoot(page, '/login', '01-dang-nhap', folder);
    await shoot(page, '/register', '02-dang-ky', folder);
    await shoot(page, '/diaries', '03-cong-dong-nhat-ky', folder);
    if (code.diaryPet) {
      await shoot(page, `/diaries/${code.diaryPet}`, '04-doc-quyen-nhat-ky', folder);
    }

    /* Nhom man hinh cua khach da dang nhap. */
    await signIn(page, BUYER);
    await shoot(page, '/home', '10-trang-chu', folder);
    await shoot(page, '/products', '11-loai-san-pham', folder);
    if (code.product) {
      await shoot(page, `/products/${code.product}`, '12-chi-tiet-san-pham', folder);
    }
    await shoot(page, '/goods', '13-hang-co-san', folder);
    if (code.goods) {
      await shoot(page, `/goods/${code.goods}`, '14-chi-tiet-hang', folder);
    }
    await shoot(page, '/colors', '15-bang-mau-len', folder);
    await shoot(page, '/pets', '16-thu-cung', folder);
    await shoot(page, '/today', '17-hom-nay', folder);
    await shoot(page, '/studio', '18-tuy-bien-3d', folder);
    await shoot(page, '/suggest', '19-goi-y-thiet-ke', folder);
    await shoot(page, '/restore', '20-phuc-hoi-anh', folder);
    await shoot(page, '/cart', '21-gio-hang', folder);
    await shoot(page, '/checkout', '22-dat-hang', folder);
    await shoot(page, '/orders', '23-don-cua-toi', folder);
    await shoot(page, '/community', '24-cong-dong', folder);

    /* Nhom man hinh noi bo. */
    await signIn(page, BOSS);
    await shoot(page, '/admin/orders', '30-dieu-phoi-don', folder);
    if (code.order) {
      await shoot(page, `/admin/orders/${code.order}`, '31-chi-tiet-don', folder);
      await shoot(page, `/admin/orders/${code.order}/production-file`, '32-ho-so-san-xuat', folder);
    }
    await shoot(page, '/admin/customers', '33-khach-hang', folder);
    if (code.customer) {
      await shoot(page, `/admin/customers/${code.customer}`, '34-ho-so-khach', folder);
    }
    await shoot(page, '/admin/goods', '35-kho-hang', folder);
    await shoot(page, '/admin/reports', '36-bao-cao', folder);
    await shoot(page, '/admin/chats', '37-truc-hoi-thoai', folder);
    await shoot(page, '/admin/materials', '38-vat-lieu', folder);
    await shoot(page, '/admin/settings', '39-tham-so', folder);
    await shoot(page, '/admin/payment-log', '40-nhat-ky-thanh-toan', folder);

    await page.close();
  }

  await browser.close();
  console.log('');
  console.log(`Anh luu tai ${OUT}`);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
