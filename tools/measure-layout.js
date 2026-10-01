/**
 * Do khung trang cua tung man hinh tren chinh trinh duyet.
 *
 * Doc tep kieu dang chi cho biet nguoi viet dinh lam gi. Bai do nay cho biet
 * trinh duyet that su ve ra cai gi: be rong khung, le trai le phai, co chu cua
 * tieu de, va do cao cua thanh tren. Cac con so lech nhau giua cac man la cho
 * can gom lai.
 *
 * Chay: node tools/measure-layout.js
 */
const { chromium } = require('playwright');

const WEB = 'http://localhost:4200';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const BUYER = { email: 'khachhang@petmory.local', password: 'Petmory@2026' };

/** Cac man hinh cua khach, va cac man hinh noi bo. */
const BUYER_PAGES = [
  ['Trang chu', '/home'],
  ['Loai san pham', '/products'],
  ['Hang co san', '/goods'],
  ['Bang mau len', '/colors'],
  ['Thu cung', '/pets'],
  ['Hom nay', '/today'],
  ['Goi y thiet ke', '/suggest'],
  ['Phuc hoi anh', '/restore'],
  ['Gio hang', '/cart'],
  ['Dat hang', '/checkout'],
  ['Don cua toi', '/orders'],
  ['Cong dong', '/community'],
];

const STAFF_PAGES = [
  ['Dieu phoi don', '/admin/orders'],
  ['Khach hang', '/admin/customers'],
  ['Kho hang', '/admin/goods'],
  ['Bao cao', '/admin/reports'],
  ['Truc hoi thoai', '/admin/chats'],
  ['Vat lieu', '/admin/materials'],
  ['Tham so', '/admin/settings'],
  ['Nhat ky thanh toan', '/admin/payment-log'],
];

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
 * Do mot man hinh.
 *
 * Khung trang duoc doan bang cach lay o con chay dai nhat nam ngay trong phan
 * noi dung chinh, vi moi man dat ten lop mot kieu nen khong tra theo ten duoc.
 */
async function measure(page, where) {
  await page.goto(`${WEB}${where}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  return page.evaluate(() => {
    const main = document.querySelector('#main, main');
    if (!main) {
      return null;
    }
    /*
     * Khung trang la o dau tien co dat be rong toi da bang mot so do cu the.
     *
     * Do la cach cac man hinh o day gioi han be ngang cua noi dung. Tim theo
     * dau hieu do chinh xac hon la tim o to nhat, vi o to nhat bao gio cung la
     * ca man hinh.
     */
    let frame = null;
    for (const node of main.querySelectorAll('*')) {
      const limit = getComputedStyle(node).maxWidth;
      if (limit.endsWith('px') && parseFloat(limit) > 400) {
        frame = node;
        break;
      }
    }
    const box = (frame ?? main).getBoundingClientRect();
    const head = document.querySelector('h1');
    const headBox = head ? head.getBoundingClientRect() : null;
    const bar = document.querySelector('.top-bar');
    return {
      frameWidth: frame ? Math.round(box.width) : 0,
      leftGutter: Math.round(box.left),
      headSize: head ? getComputedStyle(head).fontSize : '-',
      headFamily: head ? getComputedStyle(head).fontFamily.split(',')[0].replace(/"/g, '') : '-',
      headTop: headBox ? Math.round(headBox.top) : 0,
      barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : 0,
    };
  });
}

async function sweep(page, label, pages) {
  console.log('');
  console.log(label);
  console.log('-'.repeat(86));
  console.log('man hinh              khung  le trai  co chu tieu de  kieu chu tieu de   dinh tieu de');
  const widths = new Set();
  const gutters = new Set();
  const sizes = new Set();
  for (const [name, where] of pages) {
    const got = await measure(page, where);
    if (!got) {
      console.log(`${name.padEnd(22)} khong doc duoc`);
      continue;
    }
    widths.add(got.frameWidth);
    gutters.add(got.leftGutter);
    sizes.add(got.headSize);
    console.log(
      `${name.padEnd(22)}${String(got.frameWidth).padStart(5)}` +
        `${String(got.leftGutter).padStart(9)}` +
        `${got.headSize.padStart(16)}` +
        `${got.headFamily.padStart(19)}` +
        `${String(got.headTop).padStart(15)}`,
    );
  }
  return { widths, gutters, sizes };
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  console.log('DO KHUNG TRANG TREN TRINH DUYET · be rong man hinh 1440');
  console.log('='.repeat(86));

  await signIn(page, BUYER);
  const a = await sweep(page, 'MAN HINH CUA KHACH', BUYER_PAGES);

  await signIn(page, BOSS);
  const b = await sweep(page, 'MAN HINH NOI BO', STAFF_PAGES);

  const widths = new Set([...a.widths, ...b.widths]);
  const gutters = new Set([...a.gutters, ...b.gutters]);
  const sizes = new Set([...a.sizes, ...b.sizes]);

  console.log('');
  console.log('TONG KET');
  console.log('-'.repeat(86));
  console.log(`be rong khung khac nhau : ${widths.size}  (${[...widths].sort((x, y) => x - y).join(', ')})`);
  console.log(`le trai khac nhau       : ${gutters.size}  (${[...gutters].sort((x, y) => x - y).join(', ')})`);
  console.log(`co chu tieu de khac nhau: ${sizes.size}  (${[...sizes].join(', ')})`);

  await browser.close();
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
