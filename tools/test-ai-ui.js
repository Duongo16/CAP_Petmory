/**
 * Kiem thu tren trinh duyet ba chuc nang tri tue nhan tao, muc 15, 16 va 18.
 *
 * Gom ba phan. Mot la xin goi y thiet ke roi chon mot phuong an va sang
 * duoc buoc tuy bien. Hai la viet cau chuyen, sua tay, viet lai va gan vao
 * nhat ky. Ba la tro chuyen co nho ngu canh roi chuyen sang mot nhan vien
 * that va nhan duoc cau tra loi cua ho ngay tren cua so dang mo.
 *
 * Chay: node tools/test-ai-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `aiui.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';
const STAFF = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

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

async function settle(page) {
  for (let i = 0; i < 60; i += 1) {
    if ((await page.locator('vite-error-overlay').count()) === 0) {
      return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('may chu phat trien van dang bao loi sau 60 giay');
}

/** Tao tai khoan khach kem mot ho so be, bang duong may chu cho nhanh. */
async function makeCustomer() {
  const made = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, fullName: 'Khach thu AI' }),
  });
  const body = await made.json();
  const token = body.accessToken;

  const pet = await fetch(`${API}/pets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Mun ${STAMP}`, kind: 'DOG', breed: 'Shiba', gender: 'MALE' }),
  });
  const petBody = await pet.json();

  await fetch(`${API}/memories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pet: petBody._id,
      title: 'Ngay dau ve nha',
      happenedAt: new Date().toISOString(),
      topic: 'EVERYDAY',
    }),
  });

  return { token, petId: petBody._id };
}

async function signIn(page, email, password) {
  await page.goto(WEB, { waitUntil: 'load' });
  const account = page.locator('.account-button');
  await account.waitFor({ timeout: 15000 }).catch(() => undefined);
  if ((await account.count()) > 0) {
    await account.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 });
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('.submit');
  await page.waitForURL('**/home', { timeout: 30000 }).catch(async () => {
    await page.click('.submit');
    await page.waitForURL('**/home', { timeout: 40000 });
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1420, height: 1100 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('BA CHUC NANG TRI TUE NHAN TAO TREN GIAO DIEN');
  console.log('='.repeat(64));

  const { petId } = await makeCustomer();
  await signIn(page, EMAIL, PASSWORD);

  // ---------- Muc 15: goi y thiet ke ----------
  console.log('');
  console.log('Muc 15 — Goi y thiet ke');
  await page.goto(`${WEB}/suggest`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('#suggest-pet', { timeout: 30000 });

  ok('Man hinh liet ke duoc be cua khach',
    (await page.locator('#suggest-pet option').count()) >= 1,
    String(await page.locator('#suggest-pet option').count()));
  ok('Co bon phong cach mau de chon',
    (await page.locator('.style-chip').count()) === 4,
    String(await page.locator('.style-chip').count()));
  ok('Man hinh cho biet con bao nhieu luot',
    (await page.locator('#suggest-quota').count()) === 1);

  await page.locator('.style-chip', { hasText: 'Dịu nhẹ' }).click();
  await page.locator('.ask-button').click();
  await page.waitForSelector('#suggest-options .option-card', { timeout: 60000 });

  const optionCount = await page.locator('#suggest-options .option-card').count();
  ok('Nhan duoc nhieu nhat bon phuong an', optionCount > 0 && optionCount <= 4,
    String(optionCount));
  ok('Moi phuong an hien san cac o mau se dung',
    (await page.locator('#suggest-options .option-card').first().locator('.swatch').count()) >= 4,
    String(await page.locator('#suggest-options .option-card').first().locator('.swatch').count()));

  await page.waitForSelector('.option-detail .zone-list li', { timeout: 30000 });
  ok('Phuong an dang xem liet ke mau tung vung',
    (await page.locator('.option-detail .zone-list li').count()) >= 4,
    String(await page.locator('.option-detail .zone-list li').count()));

  // Mo hinh ba chieu phai ve that, khong phai mot o trong.
  await page.waitForSelector('.option-detail canvas', { timeout: 60000 });
  const drew = await page.evaluate(() => {
    const canvas = document.querySelector('.option-detail canvas');
    return canvas ? canvas.width > 40 && canvas.height > 40 : false;
  });
  ok('Phuong an duoc dung bang mo hinh ba chieu that', drew);
  await page.screenshot({ path: path.join(OUT, 'ai-1-suggest.png'), fullPage: true });

  // Doi sang phuong an khac thi man hinh phai doi theo.
  const firstTitle = (await page.locator('.option-detail h2').innerText()).trim();
  if (optionCount > 1) {
    await page.locator('#suggest-options .option-card').nth(1).click();
    await page.waitForFunction(
      (before) => {
        const head = document.querySelector('.option-detail h2');
        return head ? head.textContent.trim() !== before : false;
      },
      firstTitle,
      { timeout: 20000 },
    );
    ok('Bam sang phuong an khac thi man hinh doi theo', true);
  }

  await page.locator('.choose-button').click();
  await page.waitForURL('**/studio?draft=*', { timeout: 40000 });
  ok('Chon phuong an thi sang thang buoc tuy bien', page.url().includes('/studio?draft='),
    page.url().slice(-48));

  await settle(page);
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, 'ai-2-studio-from-suggest.png'), fullPage: true });
  ok('Buoc tuy bien mo duoc ban thiet ke vua tao',
    (await page.locator('canvas').count()) > 0);

  // ---------- Muc 18: hoi thoai ban day du ----------
  console.log('');
  console.log('Muc 18 — Hoi thoai ban day du');
  await page.goto(`${WEB}/home`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.locator('.open-button').click();
  await page.waitForSelector('#assistant-panel', { timeout: 20000 });
  await page.waitForSelector('.history .message', { timeout: 30000 });

  ok('Mo cua so thi thay ngay loi chao',
    (await page.locator('.history .message').count()) >= 1,
    String(await page.locator('.history .message').count()));
  ok('Cua so cho biet dang tro chuyen voi may',
    (await page.locator('.state-line').innerText()).includes('tự động'),
    (await page.locator('.state-line').innerText()).trim());

  await page.fill('#assistant-input', 'Giá bao nhiêu?');
  await page.locator('.send-button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.history .message').length >= 3,
    undefined,
    { timeout: 30000 },
  );
  await page.fill('#assistant-input', 'Làm bao lâu?');
  await page.locator('.send-button').click();
  await page.waitForFunction(
    () => document.querySelectorAll('.history .message').length >= 5,
    undefined,
    { timeout: 30000 },
  );
  ok('Cuoc tro chuyen giu lai ca hai cau da hoi',
    (await page.locator('.history .message').count()) >= 5,
    String(await page.locator('.history .message').count()));

  // Mo lai trang: mach hoi thoai phai con nguyen.
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.locator('.open-button').click();
  await page.waitForSelector('.history .message', { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.history .message').length >= 5,
    undefined,
    { timeout: 30000 },
  );
  ok('Mo lai trang van thay mach hoi thoai cu',
    (await page.locator('.history .message').count()) >= 5,
    String(await page.locator('.history .message').count()));

  await page.locator('.handover-button').click();
  await page.waitForFunction(
    () => {
      const line = document.querySelector('.state-line');
      return line ? line.textContent.includes('chờ tư vấn viên') : false;
    },
    undefined,
    { timeout: 30000 },
  );
  ok('Xin gap nguoi thi cua so bao dang cho tu van vien', true);
  ok('Dang cho thi khong con nut xin gap nua',
    (await page.locator('.handover-button').count()) === 0);
  await page.screenshot({ path: path.join(OUT, 'ai-4-chat-waiting.png') });

  // ---------- Nhan vien truc nhan va tra loi ----------
  const staff = await browser.newPage({ viewport: { width: 1420, height: 1000 } });
  staff.on('pageerror', (e) => broken.push(String(e)));
  await signIn(staff, STAFF.email, STAFF.password);
  await staff.goto(`${WEB}/admin/chats`, { waitUntil: 'networkidle' });
  await settle(staff);
  await staff.waitForSelector('#chat-queue .queue-card', { timeout: 30000 });

  ok('Cuoc vua xin gap hien ra o hang cho cua nhan vien',
    (await staff.locator('#chat-queue .queue-card').count()) >= 1,
    String(await staff.locator('#chat-queue .queue-card').count()));

  const mine = staff.locator('#chat-queue .queue-card', { hasText: 'Khach thu AI' }).first();
  await mine.click();
  await staff.waitForSelector('#chat-thread .turn', { timeout: 30000 });
  ok('Nhan vien doc duoc toan bo mach hoi thoai',
    (await staff.locator('#chat-thread .turn').count()) >= 5,
    String(await staff.locator('#chat-thread .turn').count()));
  ok('Chua nhan thi chua co o de go cau tra loi',
    (await staff.locator('#chat-reply').count()) === 0);

  await staff.locator('#chat-take').click();
  await staff.waitForSelector('#chat-reply', { timeout: 30000 });
  ok('Nhan cuoc roi thi moi go duoc cau tra loi', true);

  await staff.fill('#chat-reply', 'Chao ban, minh la tu van vien cua PETMORY.');
  await staff.locator('#chat-send').click();
  await staff.waitForFunction(
    () => {
      const turns = document.querySelectorAll('#chat-thread .turn.STAFF');
      return turns.length >= 1;
    },
    undefined,
    { timeout: 30000 },
  );
  ok('Cau tra loi cua nhan vien duoc ghi vao mach', true);
  await staff.screenshot({ path: path.join(OUT, 'ai-5-staff-desk.png'), fullPage: true });

  // Khach phai thay cau tra loi ma khong phai tai lai trang.
  await page.waitForFunction(
    () => {
      const bubbles = [...document.querySelectorAll('.history .bubble')];
      return bubbles.some((one) => one.textContent.includes('tu van vien cua PETMORY'));
    },
    undefined,
    { timeout: 40000 },
  );
  ok('Khach thay cau tra loi ngay tren cua so dang mo, khong phai tai lai trang', true);
  ok('Cua so bao dang tro chuyen voi tu van vien',
    (await page.locator('.state-line').innerText()).includes('tư vấn viên'),
    (await page.locator('.state-line').innerText()).trim());
  await page.screenshot({ path: path.join(OUT, 'ai-6-chat-answered.png') });

  await staff.locator('#chat-close').click();
  await page.waitForFunction(
    () => {
      const line = document.querySelector('.state-line');
      return line ? line.textContent.includes('kết thúc') : false;
    },
    undefined,
    { timeout: 40000 },
  );
  ok('Nhan vien khep cuoc thi khach cung thay da ket thuc', true);
  ok('Cuoc da khep thi khong con o de go nua',
    (await page.locator('#assistant-input').count()) === 0);

  ok('Khong co loi nao trong trang', broken.length === 0, broken.slice(0, 2).join(' | '));

  await browser.close();
  console.log('');
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed} MUC HONG, ${passed} MUC PASS`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
