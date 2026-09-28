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
  await page.waitForSelector('.chips .pm-chip', { timeout: 30000 });
  const chips = await page.locator('.chips .pm-chip').count();
  res.push(check('Every topic chip is shown', chips === 7, `${chips} chips`));
  res.push(check('The banner carries the community heading',
    (await page.locator('.banner h1').innerText()).length > 0));
  res.push(check('The composer is offered to a signed-in member',
    (await page.locator('.composer-prompt').count()) === 1));
  res.push(check('The value strip is shown',
    (await page.locator('.value-strip li').count()) === 5));

  // --- Writing a post ---
  await page.locator('.composer-prompt').click();
  await page.waitForSelector('#draft-title', { timeout: 10000 });
  await page.fill('#draft-title', 'Buoi sang cung be Miu');

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

  await page.locator('.composer-footer button[type="submit"]').click();
  await page.waitForTimeout(2000);
  const posts = await page.locator('.post-card').count();
  res.push(check('The new post appears on the feed', posts >= 1, `${posts} posts`));
  await page.screenshot({ path: path.join(OUT, 'community-2-feed.png'), fullPage: true });

  // --- Hearts ---
  await page.locator('.post-card .react').first().click();
  await page.waitForTimeout(900);
  const likeText = await page.locator('.post-card .react').first().innerText();
  res.push(check('The heart counts up', likeText.trim().startsWith('1'), likeText.trim()));

  // --- Filtering ---
  await page.locator('.chips .pm-chip').nth(2).click();
  await page.waitForTimeout(1200);
  res.push(check('Filtering by a topic with no post shows the empty line',
    (await page.locator('.pm-empty').count()) > 0));
  await page.locator('.chips .pm-chip').first().click();
  await page.waitForTimeout(1200);

  // --- The post detail ---
  await page.locator('.post-card .post-body').first().click();
  await page.waitForURL('**/community/posts/**', { timeout: 20000 });
  // The feed cards also carry .post-title, so the detail heading is picked by tag.
  await page.waitForSelector('h1.post-title', { timeout: 20000 });
  res.push(check('The detail opens with the title',
    (await page.locator('h1.post-title').innerText()).includes('Miu')));
  res.push(check('The side rail shows the view count',
    (await page.locator('.info-list dd').nth(2).innerText()).length > 0));

  await page.fill('#comment-input', 'De thuong qua!');
  await page.locator('.comment-form button[type="submit"]').click();
  await page.waitForTimeout(1600);
  res.push(check('A comment appears under the post',
    (await page.locator('.comment-list li').count()) === 1));
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
  await page.locator('.account-button').click();
  await page.locator('.logout-item').click();
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
