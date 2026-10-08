/**
 * Browser test of the three phone screens: the day's page, the memory book and
 * the full pet record.
 *
 * The viewport is a phone, because that is what these screens were drawn for
 * and the bar along the bottom only appears at that width.
 *
 * Run: node tools/test-mobile-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { waitOverlayGone } = require('./lib/made-to-order');

const WEB = process.env.PETMORY_WEB ?? 'http://localhost:4200';
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const OUT = path.join(__dirname, '..', 'test-screenshots');
const PASSWORD = 'Password@123';

function ok(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);
  return passed;
}

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

/** A day so many days before today, as the value a date field wants. */
function daysAgo(count) {
  const at = new Date(Date.now() - count * 86_400_000);
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}

/** The same day, with a time, as a date and time field wants. */
function daysAgoAt(count, clock) {
  return `${daysAgo(count)}T${clock}`;
}

/** Gia tri cua muc trong o loc chu de co nhan bat dau bang chu cho truoc. */
async function topicValue(page, label) {
  return page.$eval('#memory-topic-filter', (box, want) => {
    const hit = Array.from(box.options).find((one) => one.textContent.trim().startsWith(want));
    return hit ? hit.value : '';
  }, label);
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  // A phone, which is the width these three screens were drawn at.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && broken.push(m.text()));

  const res = [];
  try {
    console.log('PHONE SCREENS TEST');
    console.log('='.repeat(64));

    const email = `dd.${Date.now()}@petmory.local`;
    await page.request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, fullName: 'Nguoi nuoi' },
    });
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.fill('#login-email', email);
    await page.fill('#login-password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 });

    // --- The bar along the bottom ---
    res.push(ok('Thanh duoi day hien tren man hinh dien thoai',
      await page.locator('pm-bottom-nav .bar').isVisible()));
    res.push(ok('Thanh duoi day co nam cho den',
      (await page.locator('pm-bottom-nav .stop').count()) === 5));

    // Nut tro giup noi phai nam tren thanh, khong duoc che cho den nao.
    // Cho lop phu dang tai bien mat truoc, vi no che ca man hinh trong luc goi may chu.
    await waitOverlayGone(page);
    const covered = await page.evaluate(() => {
      const hidden = [];
      for (const stop of document.querySelectorAll('pm-bottom-nav .stop')) {
        const box = stop.getBoundingClientRect();
        const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        if (top !== stop && !stop.contains(top)) {
          hidden.push(stop.textContent.trim());
        }
      }
      return hidden;
    });
    res.push(ok('Khong cho den nao bi nut tro giup che', covered.length === 0,
      covered.join(', ')));

    // --- The day's page, before any pet exists ---
    await page.goto(`${WEB}/today`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.hello-line', { timeout: 20000 });
    const greeting = await page.locator('.hello-line').innerText();
    res.push(ok('Loi chao goi ten nguoi dung', greeting.includes('Nguoi nuoi'), greeting));
    res.push(ok('Chua co be nao thi moi tao ho so',
      (await page.locator('.blank').count()) === 1));

    // --- A pet with the whole record filled in ---
    await page.goto(`${WEB}/pets`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.locator('.strong').first().click();
    await page.waitForSelector('.sheet', { timeout: 15000 });
    await page.fill('#pet-name', 'Be Bo');
    await page.fill('#pet-breed', 'Golden Retriever');
    await page.fill('#pet-birth', daysAgo(420));
    await page.fill('#pet-tagline', 'Hoang thuong bon chan sieu quan chu');
    await page.fill('#pet-home', daysAgo(380));
    await page.fill('#pet-chip', '981098102948');
    await page.locator('.tick input[type="checkbox"]').check();
    await page.fill('#pet-traits', 'Thich gam tat, Me tam bien, So tieng sam');
    await page.fill('#pet-carers', ['Me Trang - Nguoi cham chinh', 'Ba Tuan - Tai xe di dao'].join('\n'));
    await page.locator('.sheet button[type="submit"]').click();
    await page.waitForTimeout(3000);

    await page.locator('.pet-deeds a').first().waitFor({ state: 'visible', timeout: 20000 });

    // --- The full record ---
    const petId = await page.evaluate(() => {
      const link = document.querySelector('.pet-deeds a');
      return link ? link.getAttribute('href').split('/')[2] : '';
    });
    res.push(ok('Tim duoc ma ho so cua be', Boolean(petId), petId));

    await page.goto(`${WEB}/pets/${petId}`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.who-name', { timeout: 20000 });
    res.push(ok('Ho so mo ra dung ten be',
      (await page.locator('.who-name').innerText()).includes('Be Bo')));
    res.push(ok('Ho so hien cau gioi thieu',
      (await page.locator('.who-line').innerText()).includes('Hoang thuong')));
    res.push(ok('Ho so hien so microchip',
      (await page.locator('.fact-code').innerText()).includes('981098102948')));
    res.push(ok('Ho so hien ngay ve nha', (await page.locator('.facts dt').allInnerTexts())
      .some((t) => t.includes('Về nhà mới'))));
    res.push(ok('Ho so hien da triet san',
      (await page.locator('.fact-note').count()) === 1));
    res.push(ok('Ho so liet ke ba net tinh cach',
      (await page.locator('.traits li').count()) === 3));
    res.push(ok('Ho so liet ke hai nguoi cham soc',
      (await page.locator('.carers li').count()) === 2));
    res.push(ok('Vai tro cua nguoi cham soc duoc tach dung',
      (await page.locator('.carer-text span').first().innerText()).includes('cham chinh')));
    res.push(ok('Ho so co khoi kho bau ky niem',
      (await page.locator('.treasure').count()) === 1));
    const figures = await page.locator('.treasure-figures dd').allInnerTexts();
    res.push(ok('Kho bau dem du ba con so', figures.length === 3, figures.join(' / ')));
    res.push(ok('Chua co ky niem nao thi dem bang khong',
      figures[1].trim() === '0', figures[1]));
    await page.screenshot({ path: path.join(OUT, 'mobile-3-profile.png'), fullPage: true });

    // --- The memory book ---
    // Nut mo quyen ky niem dua sang tu sach chung, trang viet tung trang nam o so cua be.
    await page.locator('button:has-text("Mở quyển kỷ niệm")').click();
    await page.waitForURL('**/journals**', { timeout: 20000 });
    res.push(ok('Nut mo quyen ky niem dua sang tu sach', page.url().includes(petId), page.url().slice(-40)));
    await page.goto(`${WEB}/pets/${petId}/journal`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.title', { timeout: 20000 });
    res.push(ok('Quyen ky niem mang ten be',
      (await page.locator('.title').innerText()).includes('Be Bo')));
    res.push(ok('Quyen ky niem con trong',
      (await page.locator('.pm-center.blank').count()) === 1));

    // Write one moment down.
    await page.locator('.write').click();
    await page.waitForSelector('.sheet', { timeout: 15000 });
    // Giu mau trang mac dinh, bo qua buoc chon anh, roi moi den o viet.
    await page.locator('.sheet-foot button[type="submit"]').click();
    await page.locator('.sheet-foot button[type="submit"]').click();
    await page.fill('#moment-title', 'Be Bo duoi buom ngoai cong vien');
    await page.fill('#moment-place', 'Cong vien Gia Dinh');
    await page.fill('#moment-body', 'Te lan tron ma van toe toet cuoi.');
    await page.fill('#moment-tag', '#MuaThu, CongVien');
    await page.fill('#moment-when', daysAgoAt(2, '16:45'));
    await page.check('.sheet .tick input[type="checkbox"]');
    await page.locator('.sheet button[type="submit"]').click();
    /*
     * Quyen so la cach doc mac dinh, nen phai chuyen sang dong thoi gian moi
     * thay tung the khoanh khac.
     */
    await page.locator('.view-switch button:has-text("Dòng thời gian")').click();
    await page.waitForSelector('.moment', { timeout: 20000 });

    res.push(ok('Khoanh khac vua ghi hien ra', (await page.locator('.moment').count()) === 1));
    res.push(ok('Khoanh khac giu duoc noi chon',
      (await page.locator('.moment-place').innerText()).includes('Gia Dinh')));
    const tags = await page.locator('.moment .tag').allInnerTexts();
    res.push(ok('Tu khoa bo dau thang va tach dung',
      tags.length === 2 && tags[0] === '#MuaThu', tags.join(' ')));
    res.push(ok('Cot moc duoc danh dau',
      (await page.locator('.moment.milestone').count()) === 1));
    res.push(ok('Bo dem khoanh khac tang len',
      (await page.locator('.count-chip').innerText()).includes('1')));
    await page.screenshot({ path: path.join(OUT, 'mobile-2-journal.png'), fullPage: true });

    // Filtering must keep only the chosen topic.
    // Bo loc chu de la mot o chon, nhan moi muc kem so dem nen tim theo chu dau.
    await page.selectOption('#memory-topic-filter', await topicValue(page, 'Sinh nhật'));
    await page.waitForTimeout(800);
    res.push(ok('Loc theo chu de khac thi khong con gi',
      (await page.locator('.moment').count()) === 0));
    await page.selectOption('#memory-topic-filter', await topicValue(page, 'Tất cả'));
    await page.waitForTimeout(800);
    res.push(ok('Bo loc thi khoanh khac tro lai',
      (await page.locator('.moment').count()) === 1));

    // --- The day's page now has something to show ---
    await page.goto(`${WEB}/today`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.pet strong', { timeout: 20000 });
    res.push(ok('Trang hom nay nhac den be',
      (await page.locator('.pet strong').first().innerText()).includes('Be Bo'),
      await page.locator('.pet strong').first().innerText()));
    // Dem tu ngay be ve nha chu khong phai tu ngay sinh, nen la 380 chu khong phai 420.
    res.push(ok('Trang hom nay dem so ngay gan bo tu luc be ve nha',
      (await page.locator('.pet .tag-accent').innerText()).includes('380'),
      await page.locator('.pet .tag-accent').innerText()));
    await page.waitForSelector('.entry-title', { timeout: 20000 });
    res.push(ok('Trang hom nay hien khoanh khac gan nhat',
      (await page.locator('.entry-title').first().innerText()).includes('duoi buom')));
    res.push(ok('Khoanh khac ghi kem ten be',
      (await page.locator('.entry-meta').first().innerText()).includes('Be Bo'),
      (await page.locator('.entry-meta').first().innerText()).trim()));
    await page.screenshot({ path: path.join(OUT, 'mobile-1-today.png'), fullPage: true });

    // --- The record now counts the moment ---
    await page.goto(`${WEB}/pets/${petId}`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.waitForSelector('.treasure-figures dd', { timeout: 20000 });
    const after = await page.locator('.treasure-figures dd').allInnerTexts();
    res.push(ok('Kho bau dem duoc trang ky su', after[1].trim() === '1', after.join(' / ')));
    res.push(ok('Kho bau dem duoc cot moc', after[2].trim() === '1', after.join(' / ')));

    const realErrors = broken.filter((l) => !/favicon/i.test(l));
    res.push(ok('Khong co loi nao trong trang', realErrors.length === 0,
      realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  console.log(`Anh luu tai ${OUT}`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 200));
  process.exit(1);
});
