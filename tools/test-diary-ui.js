/**
 * Kiem thu tren trinh duyet phan hoan thien nhat ky (muc 17, 19, 20).
 *
 * Gom: gan anh vao khoanh khac, bat che do cong khai, tao va thu hoi lien
 * ket chia se, xuat tep, trinh chieu, va trang cong dong doc duoc khi chua
 * dang nhap.
 *
 * Chay: node tools/test-diary-ui.js
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'test-screenshots');
fs.mkdirSync(OUT, { recursive: true });

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `nkui.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';

let failed = 0;
function ok(name, good, note = '') {
  if (!good) {
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

/** Mot buc anh co van, de khong bi cham diem la mo tit. */
async function makePhoto(where, shift) {
  const width = 800;
  const height = 800;
  const dots = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;
      const checker = ((x >> 3) + (y >> 3)) % 2 === 0;
      dots[at] = checker ? 230 : 70 + shift;
      dots[at + 1] = checker ? 180 + shift : 60;
      dots[at + 2] = checker ? 140 : 90 + shift;
    }
  }
  const bytes = await sharp(dots, { raw: { width, height, channels: 3 } }).png().toBuffer();
  fs.writeFileSync(where, bytes);
  return where;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('NHAT KY: ANH, CHIA SE, XUAT TEP, TRINH CHIEU, CONG DONG');
  console.log('='.repeat(66));

  const signUp = await page.request.post(`${API}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, fullName: 'Chu nhat ky giao dien' },
  });
  const token = (await signUp.json()).accessToken;
  const pet = await (
    await page.request.post(`${API}/pets`, {
      data: { name: `Be Nhat Ky ${STAMP}`, kind: 'CAT', tagline: 'Be thich nam cua so' },
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();

  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/home', { timeout: 30000 });

  // --- Gui hai anh vao album ---
  const files = [
    await makePhoto(path.join(OUT, `nk-a-${STAMP}.png`), 0),
    await makePhoto(path.join(OUT, `nk-b-${STAMP}.png`), 40),
  ];
  await page.goto(`${WEB}/pets/${pet._id}/journal?view=photos`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.setInputFiles('#album-file', files);
  await page.waitForSelector('.edit', { timeout: 20000 });
  for (let i = 0; i < files.length; i += 1) {
    await page.locator('.edit-foot button:has-text("Giữ ảnh gốc")').click();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('pm-pet-photos .shot img', { timeout: 30000 });
  ok('Album co hai anh', (await page.locator('pm-pet-photos .shot').count()) === 2);

  // --- Viet mot khoanh khac kem anh ---
  await page.goto(`${WEB}/pets/${pet._id}/journal`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.locator('button.write').click();
  // Buoc mot: chon mau trang hai anh, roi sang buoc chon anh.
  await page.waitForSelector('.layout-card', { timeout: 20000 });
  ok('Hop viet co cac mau trang de chon', (await page.locator('.layout-card').count()) >= 4);
  await page.locator('.layout-card:has-text("Hai ảnh so le")').click();
  await page.locator('.sheet-foot button[type="submit"]').click();
  await page.waitForSelector('.shot-grid', { timeout: 20000 });
  ok('Hop viet khoanh khac co luoi anh cua album',
    (await page.locator('.shot-pick').count()) === 2);

  await page.locator('.shot-pick').first().click();
  await page.locator('.shot-pick').nth(1).click();
  await page.locator('.shot-order').nth(1).waitFor({ timeout: 10000 });
  ok('Chon duoc hai anh cho khoanh khac',
    (await page.locator('.shot-order').count()) === 2);
  // Buoc ba: viet loi ke, trang xem truoc ve ngay ben canh.
  await page.locator('.sheet-foot button[type="submit"]').click();
  await page.fill('#moment-title', 'Buoi chieu ben cua so');
  await page.fill('#moment-body', 'Be nam suot buoi, nang vang ca phong.');
  ok('Trang xem truoc co du hai anh', (await page.locator('.preview-page .shot').count()) === 2);
  await page.screenshot({ path: path.join(OUT, 'diary-1-write.png') });
  await page.locator('.sheet-foot button[type="submit"]').click();
  await page.waitForTimeout(2500);
  // Quyen so la cach doc mac dinh, nen chuyen sang dong thoi gian de dem the.
  await page.locator('.view-switch button:has-text("Dòng thời gian")').click();
  await page.waitForTimeout(600);
  ok('Khoanh khac duoc luu', (await page.locator('.moment, .entry').count()) >= 1,
    `${await page.locator('.moment, .entry').count()} the`);

  const saved = await page.request.get(`${API}/memories/pet/${pet._id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = (await saved.json()).rows;
  ok('May chu ghi dung hai anh cho khoanh khac',
    (rows[0]?.photo?.length ?? 0) === 2, String(rows[0]?.photo?.length));
  ok('Trang duoc xep theo mau da chon',
    (rows[0]?.decor ?? []).filter((one) => one.kind === 'PHOTO').length === 2 && rows[0]?.paper === 'DOT',
    `${(rows[0]?.decor ?? []).length} mon, giay ${rows[0]?.paper}`);

  // --- Bat che do cong khai, nay nam trong hop lien ket chia se ---
  await page.locator('button:has-text("Liên kết chia sẻ")').click();
  await page.waitForSelector('.sheet .make', { timeout: 20000 });
  ok('Mac dinh la rieng tu',
    (await page.locator('.mode input').isChecked()) === false);
  await page.locator('.mode input').check();
  await page.waitForTimeout(1500);
  ok('Bat duoc che do cong khai',
    (await page.locator('.mode-note').innerText()).includes('công khai'),
    (await page.locator('.mode-note').innerText()).trim());

  // --- Tao lien ket chia se ---
  await page.locator('button:has-text("Tạo liên kết")').click();
  await page.waitForSelector('.fresh-link', { timeout: 20000 });
  const link = await page.locator('.fresh-link').inputValue();
  ok('Lien ket chia se hien ra mot lan', link.includes('/d/'), link.slice(0, 48));
  await page.locator('.share-list li').first().waitFor({ timeout: 15000 });
  ok('Danh sach lien ket dang mo co mot dong',
    (await page.locator('.share-list li').count()) === 1);
  await page.screenshot({ path: path.join(OUT, 'diary-2-share.png') });
  await page.locator('.sheet .shut').click();
  await page.waitForTimeout(600);

  // --- Xuat tep ---
  await page.locator('button:has-text("Xuất PDF")').click();
  await page.waitForSelector('.window', { timeout: 20000 });
  await page.locator('button:has-text("Bắt đầu xuất")').click();
  await page.waitForSelector('.state-line.done', { timeout: 90000 });
  ok('Xuat tep chay xong',
    (await page.locator('.state-line.done').innerText()).includes('1'),
    (await page.locator('.state-line.done').innerText()).trim());
  await page.locator('button:has-text("Lấy tệp về")').click();
  await page.waitForSelector('a:has-text("Lưu xuống máy")', { timeout: 30000 });
  const href = await page.locator('a:has-text("Lưu xuống máy")').getAttribute('href');
  ok('Nut luu xuong la mot lien ket that', (href ?? '').startsWith('blob:'), String(href));
  await page.screenshot({ path: path.join(OUT, 'diary-3-export.png') });
  await page.locator('.sheet .shut').click();
  await page.waitForTimeout(600);

  // --- Trinh chieu ---
  await page.locator('a:has-text("Trình chiếu")').click();
  await page.waitForURL('**/slideshow', { timeout: 20000 });
  await settle(page);
  await page.waitForSelector('.stage .shot', { timeout: 30000 });
  ok('Trinh chieu ve duoc anh dau tien',
    (await page.locator('.stage .shot').count()) === 1);
  ok('Bo dem bao dung so anh',
    (await page.locator('.tally').innerText()).trim() === '1 / 2',
    (await page.locator('.tally').innerText()).trim());
  ok('Co du ba kieu chuyen canh', (await page.locator('.knobs .chip').count()) === 3);
  ok('Khong co cho nao cho tai nhac len',
    (await page.locator('.knobs input[type="file"]').count()) === 0);

  await page.locator('.bar button').nth(2).click();
  await page.waitForTimeout(800);
  ok('Bam anh sau thi sang buc thu hai',
    (await page.locator('.tally').innerText()).trim() === '2 / 2',
    (await page.locator('.tally').innerText()).trim());

  await page.locator('.knobs .chip:has-text("Phóng nhẹ")').click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForSelector('.knobs .chip.on', { timeout: 30000 });
  ok('Doi hieu ung roi mo lai van giu nguyen',
    (await page.locator('.knobs .chip.on').innerText()).includes('Phóng'),
    (await page.locator('.knobs .chip.on').innerText()).trim());
  // Nhac nen: chon bai, bam phat thi nhac chay that, bam tam dung thi nhac dung.
  await page.selectOption('.knobs select', { index: 1 });
  await page.waitForSelector('audio.tune', { state: 'attached', timeout: 15000 });
  ok('Chon bai thi trinh chieu co the phat nhac', (await page.locator('audio.tune').count()) === 1);
  await page.locator('.bar .tw-btn-primary').click();
  const sounding = await page.waitForFunction(() => {
    const player = document.querySelector('audio.tune');
    return player && !player.paused && player.currentTime > 0.2;
  }, null, { timeout: 15000 }).then(() => true, () => false);
  ok('Bam phat thi nhac chay', sounding);
  ok('Nhac mo san tieng', !(await page.locator('audio.tune').evaluate((one) => one.muted)));
  await page.locator('.bar .tw-btn-primary').click();
  await page.waitForTimeout(500);
  ok('Bam tam dung thi nhac dung', await page.locator('audio.tune').evaluate((one) => one.paused));
  await page.screenshot({ path: path.join(OUT, 'diary-4-slideshow.png') });

  // --- Trang cong dong doc duoc khi chua dang nhap ---
  const guest = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const guestBroken = [];
  guest.on('pageerror', (e) => guestBroken.push(String(e)));
  await guest.goto(`${WEB}/diaries`, { waitUntil: 'networkidle' });
  await settle(guest);
  await guest.waitForSelector('.shelf .book', { timeout: 30000 });
  const names = await guest.locator('.shelf .book .book-name').allInnerTexts();
  ok('Quyen cong khai hien o trang cong dong',
    names.some((one) => one.includes(String(STAMP))), names.slice(0, 3).join(' | '));
  ok('Khong co nut binh luan, tim hay theo doi tren trang cong dong',
    (await guest.locator('button:has-text("Bình luận"), button:has-text("Theo dõi")').count()) === 0);

  ok('Moi quyen ghi ro chu nhan',
    (await guest.locator('.shelf .book-owner-name').count()) === (await guest.locator('.shelf .book').count()));
  await guest.locator(`.shelf .book:has-text("${STAMP}")`).click();
  await guest.waitForURL('**/diaries/**', { timeout: 20000 });
  await guest.waitForSelector('.book .leaf', { timeout: 30000 });
  await guest.locator('.view-switch button:has-text("Dòng thời gian")').click();
  await guest.waitForSelector('.moment', { timeout: 30000 });
  ok('Khach chua dang nhap doc duoc noi dung quyen',
    (await guest.locator('.moment h2').innerText()).includes('Buoi chieu'),
    (await guest.locator('.moment h2').innerText()).trim());
  ok('Anh trong quyen cong khai hien duoc',
    (await guest.locator('.shots img').count()) === 2);
  ok('Trang doc ghi ro la chi xem',
    (await guest.locator('.read-only').count()) === 1);
  await guest.screenshot({ path: path.join(OUT, 'diary-5-public.png'), fullPage: true });

  // --- Mo bang lien ket chia se ---
  await guest.goto(link, { waitUntil: 'networkidle' });
  await settle(guest);
  await guest.waitForSelector('.book .leaf', { timeout: 30000 });
  await guest.locator('.view-switch button:has-text("Dòng thời gian")').click();
  await guest.waitForSelector('.moment', { timeout: 30000 });
  ok('Mo bang lien ket chia se cung doc duoc',
    (await guest.locator('.moment h2').innerText()).includes('Buoi chieu'));
  await guest.locator('button:has-text("Trình chiếu")').click();
  await guest.waitForSelector('.stage .shot', { timeout: 30000 });
  ok('Nguoi cam lien ket xem duoc trinh chieu',
    (await guest.locator('.stage .shot').count()) === 1);
  ok('Nguoi cam lien ket khong doi duoc cach trinh chieu',
    (await guest.locator('.knobs').count()) === 0);

  // --- Rut ve rieng tu thi lien ket het hieu luc ---
  await page.goto(`${WEB}/pets/${pet._id}/journal`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.locator('button:has-text("Liên kết chia sẻ")').click();
  await page.waitForSelector('.sheet .make', { timeout: 20000 });
  await page.locator('.mode input').uncheck();
  await page.waitForTimeout(1800);
  await guest.goto(link, { waitUntil: 'networkidle' });
  await settle(guest);
  await guest.waitForSelector('.middle', { timeout: 30000 });
  ok('Rut ve rieng tu thi lien ket bao khong tim thay',
    (await guest.locator('.middle').innerText()).includes('Không tìm thấy'),
    (await guest.locator('.middle').innerText()).trim().slice(0, 60));

  ok('Khong co loi nao trong trang cua chu', broken.length === 0, broken.slice(0, 2).join(' | '));
  const realGuestErrors = guestBroken.filter((one) => !/404/.test(one));
  ok('Khong co loi nao trong trang cua khach', realGuestErrors.length === 0,
    realGuestErrors.slice(0, 2).join(' | '));

  for (const one of files) {
    fs.rmSync(one, { force: true });
  }
  await browser.close();
  console.log('-'.repeat(66));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
