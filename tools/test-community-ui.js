/**
 * Browser test of the community screens: the feed, the composer with its
 * ready-made opening lines, hearts, comments and the public profile.
 * Run: node tools/test-community-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
/** Cac o tren man hinh duoc chi den nhieu lan, gom lai mot cho. */
const CARD_POST = '.post-card';

const OUT = path.join(__dirname, '..', 'test-screenshots');
const PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function register(fullName) {
  const email = `cdui.${Date.now()}.${Math.floor(Math.random() * 10000)}@petmory.local`;
  await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, fullName }),
  });
  return email;
}

async function signIn(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/home', { timeout: 30000 });
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const res = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 980 } });
  const error = [];
  page.on('pageerror', (e) => error.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500) {
      error.push('HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url());
    }
  });
  // Ghi ca dia chi cua tai nguyen hong, neu khong thi thong bao cua trinh duyet
  // chi noi 'Failed to load resource' ma khong cho biet la tep nao.
  page.on('requestfailed', (q) => {
    const why = String(q.failure() && q.failure().errorText);
    if (why.includes('BLOCKED') || why.includes('FAILED')) {
      error.push(why + '  ' + q.url());
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      error.push(m.text());
    }
  });

  console.log('COMMUNITY UI TEST');
  console.log('='.repeat(66));

  const email = await register('Dieu Xuan');
  await signIn(page, email);

  // --- The feed ---
  await page.goto(`${WEB}/community`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.banner h1', { timeout: 30000 });
  res.push(check('The topic filter is gone', (await page.locator('#community-topic-filter').count()) === 0));
  res.push(check('The banner carries the community heading',
    (await page.locator('.banner h1').innerText()).length > 0));
  res.push(check('The composer is offered to a signed-in member',
    (await page.locator('.composer-prompt').count()) === 1));
  res.push(check('The value strip is shown',
    (await page.locator('.value-strip li').count()) === 5));

  // --- Writing a post ---
  // Bieu mau viet bai nam trong hop thoai, nen dong tin phia sau khong bi day di.
  await page.locator('.composer-prompt').click();
  await page.waitForSelector('#draft-title', { timeout: 10000 });
  res.push(check('The composer opens as a dialog over the feed',
    (await page.locator('.pm-dialog #draft-title').count()) === 1));
  res.push(check('The feed is still behind the dialog',
    (await page.locator(CARD_POST).count()) > 0,
    `${await page.locator(CARD_POST).count()} posts behind`));
  // Tieu de mang dau rieng cua lan chay nay. Co so du lieu dung chung voi moi
  // lan chay truoc, nen mot tieu de co dinh se trung voi bai cu.
  const mark = `Buoi sang cung be Miu ${Date.now()}`;
  await page.fill('#draft-title', mark);

  await page.locator('.link-button').click();
  await page.waitForTimeout(500);
  const template = await page.locator('#draft-content').inputValue();
  res.push(check('The template fills the box with a real sentence',
    template.length > 20 && !template.includes('{{'), template.slice(0, 40)));

  await page.fill('#draft-content', 'Meo nho cua minh that su la dieu tuyet voi nhat tren doi.');
  await page.fill('#draft-tag', 'meo');
  await page.press('#draft-tag', 'Enter');
  await page.waitForTimeout(600);
  res.push(check('A tag can be added', (await page.locator('.tag-row .pm-chip').count()) === 1));
  await page.screenshot({ path: path.join(OUT, 'community-1-composer.png'), fullPage: true });

  await page.locator('#draft-submit').click();
  await page.waitForSelector('#draft-submit', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(2000);
  const mine = page.locator(CARD_POST).filter({ hasText: mark });
  res.push(check('The new post appears on the feed', (await mine.count()) === 1,
    `${await page.locator(CARD_POST).count()} posts on the feed`));
  await page.screenshot({ path: path.join(OUT, 'community-2-feed.png'), fullPage: true });

  // --- Hearts ---
  /*
   * Do hieu so truoc va sau, khong giả dinh bai dau tien dang co bao nhieu tim.
   * Co so du lieu dung chung voi moi lan chay truoc, nen bai tren cung hoan
   * toan co the da co nguoi thich roi.
   */
  const heart = mine.locator('.react').first();
  const heartBefore = Number.parseInt((await heart.innerText()).trim(), 10);
  await heart.click();
  await page.waitForTimeout(1200);
  const heartAfter = Number.parseInt((await mine.locator('.react').first().innerText()).trim(), 10);
  res.push(check('The heart counts up', heartAfter === heartBefore + 1,
    `${heartBefore} -> ${heartAfter}`));

  // --- The post detail ---
  await page.locator('.post-card .post-body').first().click();
  // The post opens as a popup over the feed, not on a page of its own.
  await page.waitForSelector('pm-post-detail-dialog h1.post-title', { timeout: 20000 });
  res.push(check('The post opens in a popup over the feed',
    page.url().includes('/community?post=')));
  res.push(check('The detail opens with the title',
    (await page.locator('h1.post-title').innerText()).includes('Miu')));
  res.push(check('The side rail shows the view count',
    (await page.locator('.info-list dd').nth(2).innerText()).length > 0));

  await page.fill('#comment-input', 'De thuong qua!');
  await page.locator('.comment-form button[type="submit"]').click();
  await page.waitForTimeout(1600);
  res.push(check('A comment appears under the post',
    (await page.locator('.comment-list li').count()) === 1));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  res.push(check('Closing the popup leaves the feed', (await page.locator('pm-post-detail-dialog').count()) === 0));

  // The comment button goes straight to the comment box.
  await page.locator('.post-card a.react').first().click();
  await page.waitForSelector('pm-post-detail-dialog #comment-input', { timeout: 20000 });
  await page.waitForTimeout(400);
  res.push(check('The comment button puts the cursor in the comment box',
    (await page.evaluate(() => document.activeElement?.id)) === 'comment-input'));
  await page.screenshot({ path: path.join(OUT, 'community-3-detail.png'), fullPage: true });

  // --- The public profile ---
  await page.locator('.side-column .author').first().click();
  await page.waitForSelector('.identity-text h1', { timeout: 20000 });
  res.push(check('The profile shows the display name',
    (await page.locator('.identity-text h1').innerText()) === 'Dieu Xuan'));
  res.push(check('The profile shows a handle',
    (await page.locator('.handle').innerText()).startsWith('@')));
  res.push(check('The profile counts the posts',
    (await page.locator('.stats dd').first().innerText()) === '1'));
  res.push(check('Nobody is offered a follow button on their own profile',
    (await page.locator('.identity .pm-chip').count()) === 0));
  await page.screenshot({ path: path.join(OUT, 'community-4-profile.png'), fullPage: true });

  // --- Signed out ---
  await page.locator('header button[aria-haspopup]').click();
  await page.locator('[role=menuitem]', { hasText: /Đăng xuất|Log out/i }).click();
  await page.waitForURL('**/login', { timeout: 20000 });
  res.push(check('Signing out lands on the sign-in screen', page.url().includes('/login')));

  await page.goto(`${WEB}/community`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  res.push(check('A guest is sent to sign in before the community opens',
    page.url().includes('/login'), page.url()));

  const realErrors = error.filter((l) => !/favicon/i.test(l));
  res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));

  await browser.close();

  const failed = res.filter((x) => !x).length;
  console.log('='.repeat(66));
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  console.log('Screenshots saved to:', OUT);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
