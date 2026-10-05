/**
 * Browser test of the ready-made goods admin (SOW item 23): the manager creates a
 * group, creates an item with two named variant attributes, adjusts stock with a
 * required reason, reads the stock history, and cannot remove a group that still
 * holds items. Everything the test creates is removed (soft delete) at the end.
 * Run: node tools/test-goods-admin-ui.js
 */
const { chromium, request } = require('playwright');
const path = require('path');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const OUT = path.join(__dirname, '..', 'test-screenshots');
const STAMP = String(Date.now() % 1000000);
const GROUP = `NHOM-THU-${STAMP}`;
const CODE = `G-THU-${STAMP}`;
const SKU_ONE = `${CODE}-S`;
const SKU_TWO = `${CODE}-M`;
const GROUP_NAME = `Nhom kiem thu ${STAMP}`;

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Bo hang va nhom do cac luot truoc cua chinh bai kiem nay de lai. */
async function sweep(api, auth) {
  const leftover = [];
  for (let page = 1, count = 1; page <= count; page += 1) {
    const listed = await (await api.get(`${API}/admin/goods?page=${page}`, { headers: auth })).json();
    count = listed.pageCount ?? 1;
    leftover.push(...(listed.rows ?? []).filter((one) => one.code.startsWith('G-THU-')));
  }
  for (const one of leftover) {
    await api.delete(`${API}/admin/goods/${one.code}`, { headers: auth });
  }
  const groups = await (await api.get(`${API}/admin/goods/categories`, { headers: auth })).json();
  for (const one of groups) {
    if (one.code.startsWith('NHOM-THU-')) {
      await api.delete(`${API}/admin/goods/categories/${one.code}`, { headers: auth });
    }
  }
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });
  const api = await request.newContext();
  const res = [];
  const login = await (await api.post(`${API}/auth/login`, { data: MANAGER })).json();
  const auth = { Authorization: `Bearer ${login.accessToken}` };
  try {
    console.log('READY-MADE GOODS ADMIN TEST');
    console.log('='.repeat(64));
    await sweep(api, auth);

    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[formcontrolname="email"]', MANAGER.email);
    await page.fill('input[formcontrolname="password"]', MANAGER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20000 });
    await page.goto(`${WEB}/admin/goods`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.goods-tabs', { timeout: 20000 });

    // Nhom hang
    await page.click('.goods-tabs [data-tab="GROUPS"]');
    await page.click('#group-new');
    await page.fill('#group-code', 'x');
    await page.fill('#group-name', 'N');
    await page.click('#group-save');
    res.push(check('A bad group code is caught on screen',
      await page.waitForSelector('.pm-status[data-tone="bad"]', { timeout: 5000 }).then(() => true, () => false)));
    await page.fill('#group-code', GROUP);
    await page.fill('#group-name', GROUP_NAME);
    await page.fill('#group-order', '99');
    await page.click('#group-save');
    await page.waitForSelector(`tr[data-group="${GROUP}"]`, { timeout: 15000 });
    res.push(check('A new group is created and listed', true));

    // Mon hang voi hai thuoc tinh
    await page.click('.goods-tabs [data-tab="GOODS"]');
    await page.click('#goods-new');
    await page.waitForSelector('#goods-code', { timeout: 10000 });
    await page.fill('#goods-code', CODE);
    await page.fill('#goods-name', 'Mon kiem thu hai thuoc tinh');
    await page.selectOption('#goods-group', { label: GROUP_NAME });
    await page.fill('#goods-option-1', 'Kích thước');
    await page.fill('#goods-option-2', 'Màu');
    const rows = page.locator('.variant-row');
    await rows.nth(0).locator('.value-1').fill('S');
    await rows.nth(0).locator('.value-2').fill('Đỏ');
    await rows.nth(0).locator('.variant-sku').fill(SKU_ONE);
    await rows.nth(0).locator('input[formcontrolname="price"]').fill('100000');
    await rows.nth(0).locator('.variant-stock').fill('5');
    await page.click('.add-variant');
    await rows.nth(1).waitFor();
    await rows.nth(1).locator('.value-1').fill('M');
    await rows.nth(1).locator('.variant-sku').fill(SKU_TWO);
    await rows.nth(1).locator('input[formcontrolname="price"]').fill('120000');
    await page.click('#goods-save');
    res.push(check('A missing second attribute value is caught',
      await page.waitForSelector('.pm-dialog .field-error', { timeout: 5000 }).then(() => true, () => false)));
    await rows.nth(1).locator('.value-2').fill('Xanh');
    res.push(check('The header shows the attribute names typed by the admin',
      (await page.locator('.variant-head').innerText()).includes('Kích thước')));
    await page.click('#goods-save');
    await page.waitForSelector('.pm-status[data-tone="good"]', { timeout: 15000 });
    const made = await (await api.get(`${API}/admin/goods/${CODE}`, { headers: auth })).json();
    res.push(check('The item is saved with both attribute names',
      JSON.stringify(made.optionNames) === JSON.stringify(['Kích thước', 'Màu']), JSON.stringify(made.optionNames)));
    res.push(check('Each variant carries one value per attribute',
      made.variant.length === 2 && made.variant[0].optionValues.join('|') === 'S|Đỏ' && made.variant[1].optionValues.join('|') === 'M|Xanh'));
    res.push(check('The opening stock is stored', made.variant[0].stock === 5));

    // Sua: so ton bi khoa
    const row = page.locator('#goods-table tbody tr', { hasText: CODE });
    await row.locator('.row-tools button').first().click();
    await page.waitForSelector('#goods-option-1', { timeout: 10000 });
    res.push(check('Editing loads the attribute names', (await page.inputValue('#goods-option-2')) === 'Màu'));
    res.push(check('Stock and code of saved variants are locked in the edit form',
      await page.locator('.variant-row').nth(0).locator('.variant-stock').isDisabled()
      && await page.locator('.variant-row').nth(0).locator('.variant-sku').isDisabled()));
    await page.screenshot({ path: path.join(OUT, 'goods-admin-form.png') });
    await page.locator('.pm-dialog .sheet-foot .plain').click();
    await page.waitForSelector('#goods-option-1', { state: 'detached', timeout: 10000 });

    // So kho
    await row.locator('.stock-open').click();
    await page.waitForSelector('#stock-delta', { timeout: 10000 });
    res.push(check('The stock book opens on the first variant with its opening entry',
      await page.waitForSelector('#stock-history tbody tr', { timeout: 10000 }).then(() => true, () => false)));
    await page.fill('#stock-delta', '-10');
    await page.fill('#stock-note', 'Kiem ke thay thieu hang');
    await page.click('#stock-apply');
    res.push(check('Taking out more than in stock is refused',
      await page.waitForSelector('.stock-alert', { timeout: 5000 }).then(() => true, () => false)));
    await page.fill('#stock-delta', '3');
    await page.fill('#stock-note', 'abc');
    await page.click('#stock-apply');
    res.push(check('A reason that is too short is refused',
      (await page.locator('.stock-alert').innerText()).length > 0));
    await page.fill('#stock-note', 'Nhap them tu nha cung cap');
    await page.click('#stock-apply');
    await page.waitForSelector('.stock-notice', { timeout: 15000 });
    await page.waitForFunction(() => document.querySelectorAll('#stock-history tbody tr').length === 2, null, { timeout: 10000 });
    const top = await page.locator('#stock-history tbody tr').first().innerText();
    res.push(check('The history shows the new entry with before, after and reason',
      top.includes('+3') && top.includes('5 → 8') && top.includes('Nhap them tu nha cung cap'), top.replace(/\s+/g, ' ')));
    const after = await (await api.get(`${API}/admin/goods/${CODE}`, { headers: auth })).json();
    res.push(check('The server stock follows the adjustment', after.variant[0].stock === 8));
    await page.click(`.sku[data-sku="${SKU_TWO}"]`);
    await page.waitForFunction((sku) => document.querySelector('.history-title')?.textContent?.includes(sku)
      && !document.querySelector('#stock-history'), SKU_TWO, { timeout: 10000 });
    res.push(check('Switching variant shows that variant history (empty for zero opening stock)', true));
    await page.screenshot({ path: path.join(OUT, 'goods-admin-stock.png') });
    await page.locator('.stock-sheet .shut').click();
    await page.waitForFunction((code) => {
      const line = [...document.querySelectorAll('#goods-table tbody tr')].find((tr) => tr.textContent.includes(code));
      return line && line.textContent.includes('8');
    }, CODE, { timeout: 15000 });
    res.push(check('Closing the stock book refreshes the total in the table', true));

    // Nhom con hang thi khong xoa duoc
    await page.click('.goods-tabs [data-tab="GROUPS"]');
    await page.locator(`tr[data-group="${GROUP}"] .group-hide`).click();
    res.push(check('A group that still holds items cannot be removed',
      await page.waitForSelector('.pm-status[data-tone="bad"]', { timeout: 10000 }).then(() => true, () => false)));

    await api.delete(`${API}/admin/goods/${CODE}`, { headers: auth });
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('.goods-tabs [data-tab="GROUPS"]');
    await page.locator(`tr[data-group="${GROUP}"] .group-hide`).click();
    await page.waitForSelector(`tr[data-group="${GROUP}"]`, { state: 'detached', timeout: 15000 });
    res.push(check('An empty group can be removed', true));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.goods-tabs [data-tab="GOODS"]');
    await page.waitForTimeout(400);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    res.push(check('The page fits a phone without sideways scrolling', wide <= 390, String(wide)));
  } finally {
    await sweep(api, auth).catch(() => undefined);
    await browser.close();
    await api.dispose();
  }
  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 300));
  process.exit(1);
});
