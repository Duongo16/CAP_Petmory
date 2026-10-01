/**
 * Tim cac nut va duong dan bi thanh phan noi che mat.
 *
 * Nut tro chuyen va thanh dieu huong duoi day deu noi len tren noi dung. Anh
 * chup khong cho biet chac chan co che nhau hay khong, vi anh chup ca trang ve
 * thanh phan noi o mot cho khac. Bai nay hoi thang trinh duyet xem tai dung
 * diem giua mot nut thi thu nam tren cung la gi.
 *
 * Chay: node tools/check-overlap.js
 */
const { chromium } = require('playwright');

const WEB = 'http://localhost:4200';
const BUYER = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

/** Hai be rong dai dien. */
const SIZES = [
  { key: 'may tinh', width: 1440, height: 1000 },
  { key: 'dien thoai', width: 390, height: 844 },
];

const BUYER_PAGES = ['/home', '/products', '/goods', '/colors', '/pets', '/today',
  '/studio', '/suggest', '/restore', '/cart', '/checkout', '/orders', '/community'];
const STAFF_PAGES = ['/admin/orders', '/admin/customers', '/admin/goods',
  '/admin/reports', '/admin/chats', '/admin/materials', '/admin/settings', '/admin/payment-log'];

let failed = 0;
let checked = 0;

async function signIn(page, who) {
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
  await page.waitForURL('**/home', { timeout: 40000 });
}

/**
 * Doc cac nut bi che tren mot man hinh.
 *
 * Moi nut deu duoc cuon vao giua khung nhin truoc khi do, dung nhu nguoi dung
 * se lam. Mot nut tinh co nam duoi thanh cong cu cua dinh hay day man hinh o
 * vi tri cuon hien tai thi khong phai loi, vi cuon mot chut la toi. Chi khi
 * cuon vao giua roi ma van bi che thi moi la bam khong duoc.
 */
async function blockedOn(page, where) {
  await page.goto(`${WEB}${where}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(1800);
  return page.evaluate(async () => {
    const out = [];
    const nodes = document.querySelectorAll(
      'button, a[href], input, select, [role="button"]',
    );
    const rest = () => new Promise((done) => requestAnimationFrame(() => done()));
    for (const node of nodes) {
      let box = node.getBoundingClientRect();
      if (box.width < 8 || box.height < 8) {
        continue;
      }
      node.scrollIntoView({ block: 'center', inline: 'center' });
      await rest();
      await rest();
      box = node.getBoundingClientRect();
      if (box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth) {
        continue;
      }
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const top = document.elementFromPoint(x, y);
      if (!top) {
        continue;
      }
      if (node === top || node.contains(top) || top.contains(node)) {
        continue;
      }
      /* Tim xem thu dang nam tren la cai gi, de bao cho de hieu. */
      let owner = top;
      let name = '';
      while (owner && owner !== document.body) {
        if (owner.className && typeof owner.className === 'string') {
          name = owner.className.split(' ')[0];
          break;
        }
        owner = owner.parentElement;
      }
      out.push({
        label: (node.textContent || node.getAttribute('aria-label') || node.tagName)
          .trim()
          .slice(0, 32),
        covering: name || top.tagName,
      });
    }
    return out;
  });
}

async function sweep(page, label, pages, size) {
  for (const where of pages) {
    checked += 1;
    const blocked = await blockedOn(page, where);
    if (blocked.length === 0) {
      continue;
    }
    failed += 1;
    console.log(`  FAIL  ${size.key.padEnd(11)} ${where}`);
    for (const one of blocked.slice(0, 5)) {
      console.log(`          "${one.label}" bi "${one.covering}" che`);
    }
  }
  void label;
}

async function run() {
  const browser = await chromium.launch();
  console.log('TIM NUT BI THANH PHAN NOI CHE MAT');
  console.log('='.repeat(72));

  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    console.log('');
    console.log(`=== ${size.key} · ${size.width} ===`);
    await signIn(page, BUYER);
    await sweep(page, 'khach', BUYER_PAGES, size);
    await signIn(page, BOSS);
    await sweep(page, 'noi bo', STAFF_PAGES, size);
    await page.close();
  }

  await browser.close();
  console.log('');
  console.log('-'.repeat(72));
  console.log(
    failed === 0
      ? `Khong man hinh nao co nut bi che (${checked} luot kiem)`
      : `${failed}/${checked} luot kiem co nut bi che`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
