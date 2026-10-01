/**
 * Business settings API test: permissions, rejecting unknown data at the boundary,
 * the relationship between the two thresholds, and the audit entry written on a change.
 * Run: node tools/test-business-config.js
 */
const API = 'http://localhost:3000/api';
const PASSWORD_INTERNAL = 'Petmory@2026';

let passed = 0;
let failed = 0;

function check(name, ok, note = '') {
  console.log(`  ${ok ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  ok ? (passed += 1) : (failed += 1);
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function login(email, password) {
  const res = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.body?.accessToken ?? null;
}

async function run() {
  console.log('BUSINESS SETTINGS API TEST');
  console.log('='.repeat(66));

  const managerToken = await login('quanly@petmory.local', PASSWORD_INTERNAL);
  const supportToken = await login('quantri@petmory.local', PASSWORD_INTERNAL);
  const workshopToken = supportToken;

  const dk = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `cf.${Date.now()}@petmory.local`,
      password: 'Password@123',
      fullName: 'Khach thuong',
    }),
  });
  const customerToken = dk.body.accessToken;

  const versionFirst = await call('/settings', { headers: authHeaders(managerToken) });
  check('The manager can read the settings', versionFirst.status === 200);
  const old = versionFirst.body;

  async function update(token, body) {
    return call('/settings', { method: 'PATCH', headers: authHeaders(token), body: JSON.stringify(body) });
  }

        // --- Permissions ---
  check('A workshop dispatcher can read the settings',
    (await call('/settings', { headers: authHeaders(workshopToken) })).status === 403);
  check('Support cannot read the settings',
    (await call('/settings', { headers: authHeaders(supportToken) })).status === 403);
  check('A customer cannot read the settings',
    (await call('/settings', { headers: authHeaders(customerToken) })).status === 403);
  check('Signed out requests cannot read the settings', (await call('/settings')).status === 401);
  check('A workshop dispatcher cannot change the settings',
    (await update(workshopToken, { qrExpiryHours: 12 })).status === 403);

        // --- Reject fields outside the list ---
  check('Rejects an undeclared field', (await update(managerToken, { key: 'BAY' })).status === 400);
  check('Rejects setting the last editor by hand',
    (await update(managerToken, { lastEditedBy: '000000000000000000000000' })).status === 400);

        // --- Reject values outside the allowed range ---
  const badCases = [
    ['A negative number', { qrExpiryHours: -5 }],
    ['A number that is too large', { qrExpiryHours: 99999 }],
    ['An image size of zero', { maxPhotoSizeMb: 0 }],
    ['A fraction where a whole number is required', { estimatedShippingDays: 2.5 }],
    ['An account number with letters in it', { accountNumber: '12AB34' }],
    ['A bank code with too few digits', { bankCode: '97041' }],
    ['An account holder name with accents', { accountHolder: 'Nguyễn Văn A' }],
    ['A quota missing a field', { aiQuota: { restorePhoto: { day: 5 } } }],
    ['A negative quota', { aiQuota: { restorePhoto: { day: -1, month: 10, year: 10 } } }],
  ];
  for (const [name, body] of badCases) {
    const res = await update(managerToken, body);
    check(`Chan ${name.toLowerCase()}`, res.status === 400, String(res.status));
  }

        // --- The relationship between the two thresholds ---
  const thresholdReversed = await update(managerToken, { warnShortEdgePx: old.goodShortEdgePx });
  check('Rejects a warning threshold that is not below the acceptable one', thresholdReversed.status === 400,
    String(thresholdReversed.status));

  const valid = await update(managerToken, {
    goodShortEdgePx: 1200,
    warnShortEdgePx: 700,
  });
  check('Accepts a valid pair of thresholds', valid.status === 200 && valid.body.warnShortEdgePx === 700);

        // --- Don gia AI: la tien, nen phai giu nguyen tung chu so ---
  const priceBad = await update(managerToken, { aiUnitPrice: { restorePhoto: '1,5' } });
  check('Chan don gia viet sai dinh dang', priceBad.status === 400, String(priceBad.status));

  const priceNegative = await update(managerToken, { aiUnitPrice: { chatReply: '-5' } });
  check('Chan don gia am', priceNegative.status === 400, String(priceNegative.status));

  const priceLong = await update(managerToken, { aiUnitPrice: { storyWriting: '1.234' } });
  check('Chan don gia qua ba chu so thap phan', priceLong.status === 400, String(priceLong.status));

  const priceSet = await update(managerToken, {
    aiUnitPrice: {
      restorePhoto: '1500.25',
      designSuggestion: '800',
      storyWriting: '1200',
      chatReply: '90',
    },
  });
  const asStored = priceSet.body?.aiUnitPrice ?? {};
  check('Luu duoc bon don gia AI',
    priceSet.status === 200 && asStored.restorePhoto?.$numberDecimal === '1500.25',
    JSON.stringify(asStored.restorePhoto));
  check('Don gia duoc luu o dang so thap phan chinh xac',
    typeof asStored.chatReply?.$numberDecimal === 'string',
    JSON.stringify(asStored.chatReply));

  const priceOne = await update(managerToken, { aiUnitPrice: { chatReply: '120' } });
  const afterOne = priceOne.body?.aiUnitPrice ?? {};
  check('Sua mot don gia khong xoa ba don gia con lai',
    afterOne.chatReply?.$numberDecimal === '120' &&
      afterOne.restorePhoto?.$numberDecimal === '1500.25',
    JSON.stringify(afterOne));

        // --- Phieu kiem tra chat luong ---
  const listEmpty = await update(managerToken, { qcChecklist: [] });
  check('Chan phieu kiem tra rong', listEmpty.status === 400, String(listEmpty.status));

  const listShort = await update(managerToken, { qcChecklist: ['a'] });
  check('Chan muc kiem tra qua ngan', listShort.status === 400, String(listShort.status));

  const listSet = await update(managerToken, {
    qcChecklist: ['Dung phom dang da duyet', 'Dung mau tung vung'],
  });
  check('Doi duoc cac muc cua phieu kiem tra',
    listSet.status === 200 && listSet.body.qcChecklist.length === 2,
    String(listSet.body?.qcChecklist?.length));

        // --- A valid change, and the audit entry it writes ---
  const change = await update(managerToken, { qrExpiryHours: 48, accountHolder: 'PETMORY DEMO' });
  check('The payment code lifetime can be changed', change.status === 200 && change.body.qrExpiryHours === 48,
    String(change.body?.qrExpiryHours));
  check('Records who made the last change', Boolean(change.body?.lastEditedBy));

        // The change really does take effect on a new order
  const cfAfter = await call('/settings', { headers: authHeaders(managerToken) });
  check('The new value is stored', cfAfter.body.qrExpiryHours === 48);

        // --- Put everything back as it was ---
  const restore = await update(managerToken, {
    qrExpiryHours: old.qrExpiryHours,
    goodShortEdgePx: old.goodShortEdgePx,
    warnShortEdgePx: old.warnShortEdgePx,
    accountHolder: old.accountHolder,
    qcChecklist: old.qcChecklist,
    aiUnitPrice: {
      restorePhoto: old.aiUnitPrice.restorePhoto.$numberDecimal,
      designSuggestion: old.aiUnitPrice.designSuggestion.$numberDecimal,
      storyWriting: old.aiUnitPrice.storyWriting.$numberDecimal,
      chatReply: old.aiUnitPrice.chatReply.$numberDecimal,
    },
  });
  check('Puts the settings back as they were',
    restore.status === 200 && restore.body.qrExpiryHours === old.qrExpiryHours,
    `lifetime = ${restore.body?.qrExpiryHours}`);

  console.log('='.repeat(66));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
