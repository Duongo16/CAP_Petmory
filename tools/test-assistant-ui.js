/**
 * Kiem thu giao dien tro ly hoi thoai va kho tri thuc.
 *
 * Khach vang lai khong gap tro ly o dau ca; khach da dang nhap chat duoc, bam
 * cau goi y va nut dan huong; nhom Cham soc khach hang nhan va tra loi tren
 * trang truc; nhom Quan ly them, tat va an mot muc trong kho tri thuc.
 *
 * Chi dung tai khoan demo co san. Muc kho tri thuc tao ra duoc an khi xong.
 *
 * Chay: node tools/test-assistant-ui.js
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const WEB = process.env.PETMORY_WEB ?? 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const PASSWORD = 'Petmory@2026';
const STAMP = Date.now();
const TEST_CODE = `UI-${STAMP}`;
const HANDOVER_NOTE = `Mình cần hỏi về đơn hàng PM261002009 (${STAMP})`;

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

async function signIn(page, email) {
  await page.goto(`${WEB}/login`);
  await page.fill('#login-email', email);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
}

(async () => {
  console.log('GIAO DIEN TRO LY HOI THOAI');
  console.log('='.repeat(64));
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => page.on('pageerror', (e) => errors.push(e.message));

  // --- Khach vang lai ---
  const guest = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(guest);
  for (const where of ['/', '/diaries']) {
    await guest.goto(`${WEB}${where}`, { waitUntil: 'networkidle' });
    ok(`Khach vang lai khong thay tro ly o ${where}`, (await guest.locator('pm-chat-widget').count()) === 0);
  }
  await guest.goto(`${WEB}/shop`, { waitUntil: 'networkidle' });
  ok('Khach vang lai vao cua hang bi dua toi trang dang nhap', guest.url().includes('/login'), guest.url());

  // Dong cac phien cua khach demo con treo tu lan chay truoc, de bat dau sach.
  const api = WEB.replace(':4200', ':3000') + '/api';
  const desk = await (await fetch(`${api}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'cskh@petmory.local', password: PASSWORD }),
  })).json();
  const deskAuth = { authorization: `Bearer ${desk.accessToken}` };
  const queue = await (await fetch(`${api}/admin/chats`, { headers: deskAuth })).json();
  for (const one of queue) {
    if (one.owner?.email === 'khachhang@petmory.local') {
      await fetch(`${api}/admin/chats/${one.code}/take`, { method: 'POST', headers: deskAuth });
      await fetch(`${api}/admin/chats/${one.code}/close`, { method: 'POST', headers: deskAuth });
    }
  }

  // --- Khach da dang nhap ---
  const customer = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(customer);
  await signIn(customer, 'khachhang@petmory.local');
  await customer.locator('pm-chat-widget .open-button').click();
  await customer.waitForSelector('#assistant-input', { timeout: 15000 });
  const fresh = customer.locator('pm-chat-widget button', { hasText: 'Bắt đầu cuộc mới' });
  if (await fresh.count()) {
    await fresh.click();
  }
  await customer.waitForSelector('.suggestion-row .chip', { timeout: 15000 });
  const chips = await customer.locator('.suggestion-row .chip').allInnerTexts();
  ok('Cau goi y lay tu kho tri thuc', chips.some((one) => one.includes('Giá sản phẩm')), chips.slice(0, 3).join(' | '));
  await customer.locator('.suggestion-row .chip', { hasText: 'Giá sản phẩm' }).click();
  await customer.waitForFunction(() => {
    const all = [...document.querySelectorAll('pm-chat-widget .bubble')];
    return all.length > 0 && all[all.length - 1].textContent.includes('Giá theo');
  }, null, { timeout: 15000 });
  const priceText = (await customer.locator('pm-chat-widget .bubble').last().innerText()).trim();
  ok('Bam goi y thi tro ly tra loi bang gia that', /\d{3}\.\d{3} VND/.test(priceText), priceText.slice(0, 80));
  await customer.fill('#assistant-input', 'còn cỡ lớn thì sao?');
  await customer.locator('pm-chat-widget .input-row button[type=submit]').click();
  await customer.waitForTimeout(2500);
  ok('Hoi tiep van nhan duoc cau tra loi', (await customer.locator('pm-chat-widget .bubble').last().innerText()).includes('Lớn'));
  await customer.screenshot({ path: path.join(OUT, 'assistant-1-chat.png') });
  await customer.locator('pm-chat-widget .goto-button').last().click();
  await customer.waitForURL('**/shop**', { timeout: 10000 });
  ok('Nut dan huong mo dung trang', customer.url().includes('/shop'), customer.url());

  await customer.locator('pm-chat-widget .open-button').click();
  await customer.waitForSelector('pm-chat-widget .handover-button');
  await customer.fill('#assistant-input', HANDOVER_NOTE);
  await customer.locator('pm-chat-widget .handover-button').click();
  await customer.waitForTimeout(1500);
  ok('Khach chuyen duoc sang tu van vien', (await customer.locator('.state-line').innerText()).includes('chờ'));

  // --- Nhom Cham soc khach hang tren trang truc ---
  const support = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(support);
  await signIn(support, 'cskh@petmory.local');
  await support.goto(`${WEB}/admin/chats`, { waitUntil: 'networkidle' });
  const nav = await support.locator('pm-admin-shell nav a, pm-admin-shell aside a').allInnerTexts();
  ok('Thanh ben cua Cham soc khach hang co trang truc va don hang',
    nav.some((one) => one.includes('Trực hội thoại')) && nav.some((one) => /đơn/i.test(one)), nav.join(' | ').slice(0, 120));
  ok('Thanh ben cua Cham soc khach hang khong co kho hang va tham so',
    !nav.some((one) => /Tham số|Hàng có sẵn|Kho tri thức/.test(one)));
  await support.locator('#chat-queue .queue-card', { hasText: String(STAMP) }).first().click();
  await support.waitForSelector('#chat-take', { timeout: 10000 });
  await support.locator('#chat-take').click();
  await support.waitForSelector('#chat-reply', { timeout: 10000 });
  await support.fill('#chat-reply', 'Chào bạn, mình là tư vấn viên PETMORY, mình kiểm tra đơn giúp bạn nhé.');
  await support.locator('.reply-row button[type=submit]').click();
  await support.waitForTimeout(1500);
  ok('Nhan vien gui duoc cau tra loi', (await support.locator('.turn.STAFF').count()) >= 1);
  await support.screenshot({ path: path.join(OUT, 'assistant-2-desk.png') });

  await customer.waitForTimeout(7000);
  ok('Khach thay cau tra loi cua tu van vien', (await customer.locator('pm-chat-widget .bubble.from-staff').count()) >= 1);
  await support.locator('#chat-close').click();
  await support.waitForTimeout(800);

  // --- Nhom Quan ly sua kho tri thuc ---
  const boss = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(boss);
  await signIn(boss, 'quanly@petmory.local');
  await boss.goto(`${WEB}/admin/assistant`, { waitUntil: 'networkidle' });
  await boss.waitForSelector('.kb-item', { timeout: 15000 });
  ok('Trang kho tri thuc liet ke cac muc', (await boss.locator('.kb-item').count()) >= 10, String(await boss.locator('.kb-item').count()));
  await boss.locator('#kb-new').click();
  await boss.waitForSelector('#kb-code');
  await boss.fill('#kb-code', TEST_CODE);
  await boss.fill('#kb-question', 'Câu hỏi thêm từ giao diện');
  await boss.fill('#kb-keywords', `giaodien${STAMP}, thu nghiem`);
  await boss.fill('#kb-answer', 'Câu trả lời thêm từ giao diện.');
  await boss.locator('.slot', { hasText: '{{THOI_GIAN}}' }).click();
  await boss.locator('#kb-save').click();
  await boss.waitForTimeout(1500);
  const added = boss.locator('.kb-item', { hasText: TEST_CODE });
  ok('Them duoc muc moi tu giao dien', (await added.count()) === 1);
  await boss.screenshot({ path: path.join(OUT, 'assistant-3-knowledge.png'), fullPage: false });
  await added.locator('button', { hasText: 'Tắt' }).click();
  await boss.waitForTimeout(1200);
  ok('Tat duoc muc vua them', (await boss.locator('.kb-item.is-off', { hasText: TEST_CODE }).count()) === 1);
  await boss.locator('.kb-item', { hasText: TEST_CODE }).locator('button', { hasText: 'Ẩn' }).click();
  await boss.waitForTimeout(1200);
  ok('An duoc muc vua them', (await boss.locator('.kb-item', { hasText: TEST_CODE }).count()) === 0);

  ok('Khong co loi nao trong trang', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
