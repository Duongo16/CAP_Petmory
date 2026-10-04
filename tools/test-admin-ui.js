/**
 * Browser test: the order dispatch board, order detail, customer profiles and the
 * payment log. Also checks the difference between an operations account and one
 * that may only read.
 * Run: node tools/test-admin-ui.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WEB = 'http://localhost:4200';
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';
/** Cac o khac tren man quan tri, cung duoc chi den nhieu lan. */
const ROW_TABLE = '.table tbody tr';
const CHIP_STATUS = '.status-chip.large';
const FILTER_LOG = '.log-filters .filter';
const CARD_SETTING = 'form .card';
const STATE_MAKING = 'Đang làm';
const STATE_SHIPPING = 'Đang giao';

const ROW_MODEL = '#model-table tbody tr';

/** Cac o cua man vat lieu, duoc chi den nhieu lan. */
const ROW_COLOUR = '#color-table tbody tr';
const BOX_COLOUR_CODE = '#color-code';
const BTN_COLOUR_SAVE = '#color-save';
const GONE = 'detached';

const OUT = path.join(__dirname, '..', 'test-screenshots');
const PASSWORD_INTERNAL = 'Petmory@2026';
const CUSTOMER_PASSWORD = 'Password@123';

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

async function login(page, email, password, destination = '**/home') {
        // Any other session has to be signed out first, because the sign-in screen turns
        // away a user who is already signed in and sends them back to the home page.
        //
        // Wait for the page to load, not for the network to fall silent. A guard that
        // redirects keeps a request in flight, so waiting for silence waits for ever.
  await page.goto(WEB, { waitUntil: 'load' });
  await page.locator('.account-button').waitFor({ timeout: 12000 }).catch(() => undefined);
  const accountButton = page.locator('.account-button');
  if ((await accountButton.count()) > 0) {
    await accountButton.click();
    await page.locator('.logout-item').click();
    await page.waitForURL('**/login', { timeout: 20000 });
  }
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('input[formcontrolname="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(destination, { timeout: 20000 });
}

/** Uses the API to set up a customer with one paid order in advance. */
async function makeCustomerWithOrder(page, fullName) {
  const email = `gq.${Date.now()}@petmory.local`;
  const dk = await page.request.post(`${API}/auth/register`, {
    data: { email, password: CUSTOMER_PASSWORD, fullName },
  });
  const token = (await dk.json()).accessToken;
  const label = { Authorization: `Bearer ${token}` };

  await page.request.post(`${API}/cart/items`, {
    headers: label,
    data: { productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1 },
  });
  const order = await page.request.post(`${API}/orders`, {
    headers: label,
    data: {
      fullName,
      phone: '0987654321',
      address: '99 Duong XYZ',
      province: 'Da Nang',
    },
  });
  const orderCode = (await order.json()).orderCode;

  await page.request.post(`${API}/payments/webhook`, {
    headers: { Authorization: `Apikey ${WEBHOOK_KEY}` },
    data: { id: `gq-${Date.now()}`, transferAmount: 250000, content: `CT DEN ${orderCode}` },
  });
  return { email, fullName, orderCode };
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const error = [];
  page.on('pageerror', (e) => error.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && error.push(m.text()));

  const res = [];
  try {
    console.log('INTERNAL OPERATIONS UI TEST');
    console.log('='.repeat(66));

    const customer = await makeCustomerWithOrder(page, 'Tran Thi Giao Dien');

                // --- A customer does not see the internal menu ---
                //
                // The internal links now live inside the account menu, so the menu has to
                // be opened before counting. Counting with it shut would pass for everyone.
    await login(page, customer.email, CUSTOMER_PASSWORD);
    await page.locator('.account-button').click();
    await page.waitForSelector('.account-menu', { timeout: 20000 });
    res.push(check('A customer does not see the internal menu',
      (await page.locator('.account-menu .internal-link').count()) === 0));
    await page.keyboard.press('Escape');

    /*
     * Cho den luc tep tai xong, khong cho den luc mang im han.
     *
     * Cua kiem quyen day nguoi dung sang trang khac ngay giua chung, nen mang
     * khong bao gio lang, va cho lang han la cho mai.
     */
    await page.goto(`${WEB}/admin/orders`, { waitUntil: 'load' });
    await page.waitForTimeout(1600);
    res.push(check('A customer is turned away from the operations screens',
      page.url().includes('/home'), page.url()));

                // --- The manager reaches the dispatch board ---
    await login(page, 'quanly@petmory.local', PASSWORD_INTERNAL);
    await page.locator('.account-button').click();
    await page.waitForSelector('.account-menu', { timeout: 20000 });
    res.push(check('The manager sees all five internal menu items',
      (await page.locator('.account-menu .internal-link').count()) === 5,
      (await page.locator('.account-menu .internal-link').allInnerTexts()).join(' / ')));

    await page.locator('.account-menu .internal-link').first().click();
    await page.waitForURL('**/admin/orders', { timeout: 20000 });
    await page.waitForSelector('.counter-tile', { timeout: 30000 });
    res.push(check('The dispatch board shows all six statuses',
      (await page.locator('.counter-tile').count()) === 6));

    /*
     * Kiem tong tren tat ca o dem, khong kiem rieng mot trang thai.
     * Co so du lieu dung chung voi moi lan chay truoc, va cac kich ban tich hop
     * day don hang di qua het cac trang thai, nen so o mot trang thai cu the
     * hoan toan co the ve khong ma he thong van dung.
     */
    /*
     * Cho cac o dem nhan duoc so lieu.
     * O duoc ve ra ngay voi so khong roi moi duoc dien, nen doc lien tay se
     * luon thay khong ma khong chung minh duoc gi.
     */
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll('.counter-tile .number'))
            .reduce((sum, el) => sum + (Number(el.textContent) || 0), 0) > 0,
        undefined,
        { timeout: 20000 },
      )
      .catch(() => undefined);

    const counts = (await page.locator('.counter-tile .number').allInnerTexts()).map(Number);
    const totalBefore = counts.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
    res.push(check('The dispatch tiles carry real figures', totalBefore >= 1,
      `${totalBefore} orders across ${counts.length} statuses`));
    await page.waitForSelector(ROW_TABLE, { timeout: 20000 });
    await page.screenshot({ path: path.join(OUT, 'admin-1-orders-board.png') });

                // --- Filter by status ---
    /*
     * The board is shared, so which statuses hold orders changes from run to
     * run. The test picks a tile that actually counts something instead of a
     * fixed position, then checks every row carries that tile's own status.
     */
    const tiles = page.locator('.counter-tile');
    let picked = -1;
    let pickedName = '';
    for (let i = 0; i < (await tiles.count()); i += 1) {
      const one = tiles.nth(i);
      if (Number(await one.locator('.number').innerText()) > 0) {
        picked = i;
        pickedName = (await one.locator('.tile-name').innerText()).trim();
        break;
      }
    }
    await tiles.nth(picked < 0 ? 0 : picked).click();
    await page.waitForTimeout(1200);
    const statusChip = await page.locator('.table tbody .status-chip').allInnerTexts();
    res.push(check('Clicking a tile filters by that status',
      picked >= 0 && statusChip.length > 0 && statusChip.every((t) => t.trim() === pickedName),
      `${statusChip.length} dong ${pickedName}`));
    res.push(check('The selected tile is marked',
      (await page.locator('.counter-tile.selected').count()) === 1));

                // --- Search ---
    // The status filter is still on from the check above, and the order being
    // looked for need not sit in that status, so it is cleared first.
    await tiles.nth(picked < 0 ? 0 : picked).click();
    await page.waitForTimeout(800);
    await page.fill('#search-order', customer.orderCode);
    await page.locator('button:has-text("Tìm")').click();
    await page.waitForTimeout(1200);
    res.push(check('Searching by order code returns exactly one row',
      (await page.locator(ROW_TABLE).count()) === 1));

    await page.locator('button:has-text("Bỏ lọc")').click();
    await page.waitForTimeout(1200);
    res.push(check('Clearing the filter returns the full list',
      (await page.locator('.counter-tile.selected').count()) === 0));

                // --- Order detail ---
    await page.goto(`${WEB}/admin/orders/${customer.orderCode}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.timeline li', { timeout: 20000 });
    const cardDelivery = page.locator('.card:has-text("Thông tin nhận hàng")');
    res.push(check('Detail shows the recipient name',
      (await cardDelivery.innerText()).includes(customer.fullName)));
    res.push(check('Detail shows the recipient phone number',
      (await cardDelivery.innerText()).includes('0987654321')));
    res.push(check('Detail carries the activity history',
      (await page.locator('.timeline li').count()) >= 1));

    const nodeTransition = await page.locator('.card:has-text("Chuyển trạng thái") button').allInnerTexts();
    res.push(check('Only legal transitions are offered',
      nodeTransition.map((t) => t.trim()).join('|') === `${STATE_MAKING}|Đã hủy`,
      nodeTransition.join('|')));
    await page.screenshot({ path: path.join(OUT, 'admin-2-order-detail.png') });

                // --- Status change with a reason ---
    await page.fill('#reason-input', 'workshop received the goods');
    await page.locator(`button:has-text("${STATE_MAKING}")`).click();
    /*
     * Doi den khi the trang thai doi han, thay vi doi mot khoang co dinh.
     * Khoang co dinh du dai luc may ranh, nhung khi may ban thi bai kiem thu
     * doc phai the cu va bao hong oan.
     */
    await page
      .locator(`${CHIP_STATUS}:has-text("${STATE_MAKING}")`)
      .waitFor({ timeout: 20000 });
    const labelNext = (await page.locator(CHIP_STATUS).innerText()).trim();
    res.push(check('The order can be moved to in production', labelNext === STATE_MAKING, labelNext));

    const historyFirst = await page.locator('.timeline li').first().innerText();
    res.push(check('The reason is written into the history', historyFirst.includes('workshop received the goods')));
    res.push(check('History records who did it', historyFirst.includes('Quan ly PETMORY')));

    const nodeAfter = await page.locator('.card:has-text("Chuyển trạng thái") button').allInnerTexts();
    res.push(check('The list of next steps updates itself',
      nodeAfter.map((t) => t.trim()).join('|') === `${STATE_SHIPPING}|Đã hủy`,
      nodeAfter.join('|')));
    await page.screenshot({ path: path.join(OUT, 'admin-3-status-changed.png') });

                // --- Quality checklist ---
                //
                // The checklist is laid out on entering the workshop and now gates
                // the step out to shipping, since the separate quality status is gone.
    await page.waitForSelector('.quality-list li', { timeout: 20000 });
    const countTick = await page.locator('.quality-tick input').count();
    res.push(check('Entering the workshop lays out the checklist', countTick >= 1,
      `${countTick} muc`));
    res.push(check('The checklist starts with nothing ticked',
      (await page.locator('.quality-tick input:checked').count()) === 0));

    await page.locator(`button:has-text("${STATE_SHIPPING}")`).click();
    await page.waitForTimeout(1200);
    res.push(check('Shipping is refused while the checklist is open',
      (await page.locator(CHIP_STATUS).innerText()).trim() === STATE_MAKING));
    const wordRefusal = (await page.locator('p.error[role="alert"]').innerText()).trim();
    res.push(check('The refusal names the checklist as the reason',
      wordRefusal.includes('kiểm tra chất lượng'), wordRefusal));

    for (let at = 0; at < countTick; at += 1) {
      await page.locator('.quality-tick input').nth(at).check();
    }
                // Doi may chu ghi nhan du ca bay lan tich roi moi doc man hinh.
    await page
      .locator('.quality-when')
      .nth(countTick - 1)
      .waitFor({ timeout: 20000 });
    res.push(check('Every item can be ticked',
      (await page.locator('.quality-tick input:checked').count()) === countTick));
    res.push(check('The counter says the checklist is done',
      (await page.locator('.quality-left').innerText()).trim() === 'Đã tích đủ'));
    res.push(check('A tick records the time it was made',
      (await page.locator('.quality-when').count()) === countTick));
    await page.screenshot({ path: path.join(OUT, 'admin-3b-quality-check.png') });

    await page.locator(`button:has-text("${STATE_SHIPPING}")`).click();
    await page.waitForTimeout(1500);
    res.push(check('With the checklist done the order moves on',
      (await page.locator(CHIP_STATUS).innerText()).trim() === STATE_SHIPPING));

                // --- Customer profile ---
    await page.goto(`${WEB}/admin/customers`, { waitUntil: 'networkidle' });
    await page.waitForSelector(ROW_TABLE, { timeout: 20000 });
    await page.fill('#search-customer', customer.email);
    await page.locator('button:has-text("Tìm")').click();
    await page.waitForTimeout(1200);
    res.push(check('A customer can be found by email',
      (await page.locator(ROW_TABLE).count()) === 1));

    await page.locator('.table tbody a').first().click();
    await page.waitForURL(/admin\/customers\/[0-9a-f]{24}$/, { timeout: 20000 });
    await page.waitForSelector('.card', { timeout: 20000 });
    res.push(check('A customer profile shows their order history',
      (await page.locator(ROW_TABLE).count()) === 1));
    res.push(check('A customer profile shows their email',
      (await page.locator('.who-lines span').first().innerText()).trim() === customer.email));
    res.push(check('A customer profile counts their orders, spend and pets',
      (await page.locator('.who-figures div').count()) === 3));
    res.push(check('A customer profile shows how far they are up the tiers',
      (await page.locator('.tier-rail').count()) === 1));
    await page.screenshot({ path: path.join(OUT, 'admin-4-customer-profile.png') });

                // --- Payment log ---
    await page.goto(`${WEB}/admin/payment-log`, { waitUntil: 'networkidle' });
    await page.waitForSelector(ROW_TABLE, { timeout: 20000 });
    res.push(check('The payment log has entries', (await page.locator(ROW_TABLE).count()) >= 1));
    res.push(check('The payment log links through to the order',
      (await page.locator(`.table a:has-text("${customer.orderCode}")`).count()) >= 1));

    // The log is long, so it must arrive a page at a time rather than all at once.
    const logRows = await page.locator(ROW_TABLE).count();
    res.push(check('The log shows one page at a time', logRows <= 25, `${logRows} rows`));
    res.push(check('The log reports five outcome groups',
      (await page.locator(FILTER_LOG).count()) === 5));
    res.push(check('The log carries a money summary',
      (await page.locator('.money-tile').count()) === 4));

    // Every outcome group must hold only its own kind of notice.
    await page.locator(FILTER_LOG).nth(1).click();
    await page.waitForTimeout(600);
    const onlyMatched = await page.locator('.table tbody .status-chip').allInnerTexts();
    res.push(check('Filtering the log keeps only that outcome',
      onlyMatched.length > 0 && onlyMatched.every((t) => t.trim() === 'Khớp đơn'),
      `${onlyMatched.length} rows`));

    // The counts on the pills must add up to the whole log.
    const pill = await page.locator(FILTER_LOG).allInnerTexts();
    const figures = pill.map((t) => Number(/\((\d+)\)/.exec(t)[1]));
    res.push(check('The group counts add up to the whole log',
      figures[0] === figures[1] + figures[2] + figures[3] + figures[4], figures.join(' vs ')));

    await page.locator(FILTER_LOG).first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'admin-5-payment-log.png') });

                // --- Materials palette: adding and editing through the dialog ---
                //
                // This screen had no test of its own before. Both the adding and the
                // editing of a colour now happen in a dialog over the table.
    await page.goto(`${WEB}/admin/materials`, { waitUntil: 'load' });
    await page.waitForSelector(ROW_COLOUR, { timeout: 30000 });
    const colourRows = await page.locator(ROW_COLOUR).count();
    res.push(check('The palette lists its colours', colourRows > 0, `${colourRows} rows`));

    const colourCode = `UI${Date.now()}`.slice(0, 12).toUpperCase();
    await page.locator('#color-new').click();
    await page.waitForSelector(BOX_COLOUR_CODE, { timeout: 20000 });
    res.push(check('Adding a colour opens a dialog over the table',
      (await page.locator('.pm-dialog #color-code').count()) === 1));
    res.push(check('The table stays behind the dialog',
      (await page.locator(ROW_COLOUR).count()) === colourRows));
    res.push(check('A new colour may have its code typed',
      !(await page.locator(BOX_COLOUR_CODE).isDisabled())));
    await page.fill(BOX_COLOUR_CODE, colourCode);
    await page.fill('#color-name', 'Mau thu giao dien');
    await page.locator(BTN_COLOUR_SAVE).click();
    await page.waitForSelector(BTN_COLOUR_SAVE, { state: GONE, timeout: 20000 });
    await page.waitForFunction(
      (want) => document.querySelector('#color-table')?.textContent?.includes(want) ?? false,
      colourCode,
      { timeout: 30000 },
    );
    res.push(check('The new colour appears in the table', true));

    const colourRow = page.locator(ROW_COLOUR, { hasText: colourCode });
    await colourRow.locator('button:has-text("Sửa")').click();
                // Wait until the code box actually carries this colour. Waiting only for
                // the box to appear can read the add dialog when the machine is busy.
    await page.waitForFunction(
      (want) => document.querySelector(want.box)?.value === want.code,
      { box: '.pm-dialog #color-code', code: colourCode },
      { timeout: 20000 },
    );
    res.push(check('Editing a colour locks its code',
      await page.locator(`.pm-dialog ${BOX_COLOUR_CODE}`).isDisabled()));
    await page.fill('#color-name', 'Mau thu da sua');
    await page.locator(BTN_COLOUR_SAVE).click();
    await page.waitForSelector(BTN_COLOUR_SAVE, { state: GONE, timeout: 20000 });
    await page.waitForFunction(
      (want) => document.querySelector('#color-table')?.textContent?.includes(want) ?? false,
      'Mau thu da sua',
      { timeout: 30000 },
    );
    res.push(check('The edited name shows in the table', true));

                // Turn the test colour off again so the customer palette is left as it was
    await colourRow.locator('button:has-text("Tắt")').click();
    await page.waitForTimeout(900);
    res.push(check('A colour can be turned off from its row',
      (await colourRow.getAttribute('class'))?.includes('is-off') ?? false,
      (await colourRow.getAttribute('class')) ?? ''));
    await page.screenshot({ path: path.join(OUT, 'admin-7-materials.png'), fullPage: true });

                // --- 3D model comparison screen ---
                //
                // Three shape groups side by side. The felted group is the realistic
                // model reshaped, so it must report the same file, not a new one.
    await page.goto(`${WEB}/admin/models`, { waitUntil: 'load' });
    await page.waitForSelector(ROW_MODEL, { timeout: 30000 });
    const modelRows = await page.locator(ROW_MODEL).count();
    res.push(check('The model screen lists every model on hand', modelRows >= 19, `${modelRows} rows`));

    await page.locator('.kind-bar .pm-chip', { hasText: 'Chó' }).first().click();
    await page.waitForTimeout(6000);
    res.push(check('A dog is offered in all three shape groups',
      (await page.locator('.shape-card .none-yet').count()) === 0));

    const files = await page.locator('.facts dd.thin').allInnerTexts();
    res.push(check('The felted shape reuses the realistic model file',
      files[0] === files[1], files.slice(0, 2).join(' vs ')));

                // The zone count is read from the model file itself once it has loaded,
                // so it says what can really be coloured separately.
    const zoneCells = await page.locator('.facts dd').nth(2).innerText();
    res.push(check('The realistic file offers more than one colour zone',
      Number.parseInt(zoneCells, 10) > 1, zoneCells.slice(0, 40)));

    await page.locator('.kind-bar .pm-chip', { hasText: 'Mèo' }).first().click();
    await page.waitForTimeout(3000);
    res.push(check('A cat is honestly reported as missing from two groups',
      (await page.locator('.shape-card .none-yet').count()) === 2));
    await page.screenshot({ path: path.join(OUT, 'admin-8-models.png'), fullPage: true });

                // --- Business settings page ---
    await page.goto(`${WEB}/admin/settings`, { waitUntil: 'networkidle' });
    await page.waitForSelector(CARD_SETTING, { timeout: 30000 });
    res.push(check('The settings page shows all six groups',
      (await page.locator(CARD_SETTING).count()) === 6));
    const accountNumber = await page.locator('input[formcontrolname="accountNumber"]').inputValue();
    res.push(check('Reads the current account number', accountNumber.length >= 6, accountNumber));
    res.push(check('Warns about the receiving account',
      (await page.locator('.note.warn').innerText()).includes('tiền của khách')));
    await page.screenshot({ path: path.join(OUT, 'admin-6-settings.png') });

                // Bad input is stopped in the interface itself, without calling the server
    await page.fill('input[formcontrolname="bankCode"]', '123');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForTimeout(800);
    res.push(check('A wrong bank code is rejected in the interface',
      (await page.locator('.field-error').count()) === 1));

    await page.fill('input[formcontrolname="bankCode"]', '970415');
    await page.fill('input[formcontrolname="warnShortEdgePx"]', '2000');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForTimeout(800);
    res.push(check('Rejects a warning threshold that is not below the acceptable one',
      (await page.locator('.error').innerText()).includes('nhỏ hơn')));

    await page.fill('input[formcontrolname="warnShortEdgePx"]', '600');
    await page.fill('input[formcontrolname="estimatedShippingDays"]', '4');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForSelector('.saved', { timeout: 20000 });
    res.push(check('A valid change can be saved', true));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector(CARD_SETTING, { timeout: 20000 });
    res.push(check('Reloading still shows the new value',
      (await page.locator('input[formcontrolname="estimatedShippingDays"]').inputValue()) === '4'));

                // Put the old value back so the other tests are unaffected
    await page.fill('input[formcontrolname="estimatedShippingDays"]', '3');
    await page.locator('button:has-text("Lưu")').click();
    await page.waitForSelector('.saved', { timeout: 20000 });

                // --- The account admin group cannot reach any running screen ---
    await login(page, 'quantri@petmory.local', PASSWORD_INTERNAL);
    for (const where of ['/admin/orders', '/admin/settings', '/admin/customers']) {
      await page.goto(`${WEB}${where}`, { waitUntil: 'load' });
      await page.waitForTimeout(1600);
      res.push(check(`The account admin group is turned away from ${where}`,
        !page.url().includes(where), page.url()));
    }

                // --- but it does reach its own screen ---
    await page.goto(`${WEB}/admin/accounts`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#account-table', { timeout: 20000 });
    res.push(check('The account admin group reaches the account screen',
      page.url().includes('/admin/accounts'), page.url()));

    /*
     * Loi 400 khi thu chuyen sang cho giao luc phieu con do la co y: bai kiem
     * thu dung tay tao ra no de xem may chu co chan that khong. Khong tinh la
     * loi cua trang.
     */
    const realErrors = error.filter(
      (l) => !/favicon/i.test(l) && !/status of 400/.test(l),
    );
    res.push(check('No javascript error', realErrors.length === 0, realErrors.slice(0, 2).join(' | ')));
  } finally {
    await browser.close();
  }

  console.log('='.repeat(66));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 700));
  process.exit(1);
});
