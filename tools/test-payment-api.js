/**
 * Ordering and payment flow test at the API level.
 * Also covers the awkward cases: wrong shared secret, duplicate notification, short payment.
 * Run: node tools/test-payment-api.js
 */
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';

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

async function run() {
  console.log('ORDERING AND PAYMENT API TEST');
  console.log('='.repeat(64));

  const email = `tt.${Date.now()}@petmory.local`;
  const dk = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123', fullName: 'Payment test' }),
  });
  const token = dk.body.accessToken;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  check('Create an account', dk.status === 201);

        // --- Cart ---
  const add = await call('/cart/items', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 2 }),
  });
  check('Add to the cart', add.status === 201, `total ${add.body.total}`);
  check('The cart totals correctly', add.body.total === '1500000');

        // The price must come from the server: a forged price sent along is rejected as an unknown field
  const forged = await call('/cart/items', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1, unitPrice: '1' }),
  });
  check('Rejects a price sent by the browser', forged.status === 400);

        // --- Create an order ---
  const orderError = await call('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ fullName: 'A', phone: '123', address: 'x', province: 'y' }),
  });
  check('Rejects malformed delivery details', orderError.status === 400);

  const order = await call('/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      address: '12 Duong ABC, Phuong 1',
      province: 'Ha Noi',
      note: 'Giao gio hanh chinh',
    }),
  });
  check('An order is created from the cart', order.status === 201, order.body.orderCode);
  check('The order is awaiting payment', order.body.status === 'AWAITING_PAYMENT');
  check('The order keeps the same total', order.body.total.$numberDecimal === '1500000');
  check('The order carries an estimated delivery date', Boolean(order.body.estimatedDelivery));

  const orderCode = order.body.orderCode;
  const reference = order.body.reference;

  const cartAfter = await call('/cart', { headers: auth });
  check('The cart is emptied once the order is placed', cartAfter.body.items.length === 0);

        // --- Payment code ---
  const qr = await call(`/payments/qr/${orderCode}`, { headers: auth });
  check('A payment code is generated', qr.status === 200 && qr.body.qrImage.startsWith('data:image/png'));
  check('The payment code carries the right amount', qr.body.amount === '1500000');
  check('The transfer message contains the reference', qr.body.transferMessage === reference);

        // Someone else's order cannot be viewed
  const email2 = `tt2.${Date.now()}@petmory.local`;
  const dk2 = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email2, password: 'Password@123', fullName: 'Nguoi khac' }),
  });
  const steal = await call(`/payments/qr/${orderCode}`, {
    headers: { Authorization: `Bearer ${dk2.body.accessToken}` },
  });
  check('Another user cannot view the order', steal.status === 404);

        // --- Transfer notification ---
  const wrongKey = await call('/payments/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Apikey sai-khoa' },
    body: JSON.stringify({ id: 1, transferAmount: 1500000, content: reference }),
  });
  check('Rejects a notification with the wrong shared secret', wrongKey.status === 401);

  const hdr = { 'Content-Type': 'application/json', Authorization: `Apikey ${WEBHOOK_KEY}` };

  const notCode = await call('/payments/webhook', {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ id: `no-${Date.now()}`, transferAmount: 1500000, content: 'chuyen tien' }),
  });
  check('A notification with no reference', notCode.body.result === 'NO_REFERENCE');

  const missing = await call('/payments/webhook', {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ id: `it-${Date.now()}`, transferAmount: 500000, content: `CK ${reference}` }),
  });
  check('A short payment does not move the order', missing.body.result === 'UNDERPAID');

  const remainingAwaiting = await call(`/orders/${orderCode}`, { headers: auth });
  check('The order is still awaiting payment after a short payment', remainingAwaiting.body.status === 'AWAITING_PAYMENT');

  const maGd = `ok-${Date.now()}`;
  const raw = await call('/payments/webhook', {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ id: maGd, transferAmount: 1500000, content: `CT DEN ${reference}` }),
  });
  check('A notification for the full amount matches the order', raw.body.result === 'MATCHED');

  const paid = await call(`/orders/${orderCode}`, { headers: auth });
  check('The order moves to paid', paid.body.status === 'PAID');
  check('The order records when it was paid', Boolean(paid.body.paidAt));

  const duplicate = await call('/payments/webhook', {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ id: maGd, transferAmount: 1500000, content: `CT DEN ${reference}` }),
  });
  check('Re-sending the same transaction is ignored', duplicate.body.result === 'ALREADY_PROCESSED');

  const customerLog = await call('/payments/log', { headers: auth });
  check('A customer cannot read the payment log', customerLog.status === 403);

  // --- SePay contract ---
  check('The webhook answers the way SePay requires', raw.status === 200 && raw.body.success === true);

  const manager = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'quanly@petmory.local', password: 'Petmory@2026' }),
  });
  const mgr = { Authorization: `Bearer ${manager.body.accessToken}`, 'Content-Type': 'application/json' };
  const settings = await call('/settings', { headers: mgr });
  const shopAccount = settings.body.accountNumber;

  /** Dat mot don moi mot mon, tra ve ma tham chieu. */
  async function newOrder() {
    await call('/cart/items', { method: 'POST', headers: auth, body: JSON.stringify({ productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1 }) });
    const made = await call('/orders', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ fullName: 'Nguyen Van A', phone: '0901234567', address: '12 Duong ABC, Phuong 1', province: 'Ha Noi' }),
    });
    return made.body;
  }
  const send = (body) => call('/payments/webhook', { method: 'POST', headers: hdr, body: JSON.stringify(body) });
  const status = async (code) => (await call(`/orders/${code}`, { headers: auth })).body.status;

  const second = await newOrder();
  const fullPayload = await send({
    id: Date.now(), gateway: 'VietinBank', transactionDate: '2026-10-04 10:00:00', accountNumber: shopAccount,
    subAccount: null, code: second.reference, content: `${second.reference} chuyen tien`, transferType: 'in',
    description: 'NGUYEN VAN A chuyen tien', transferAmount: 750000, accumulated: 9750000,
    referenceCode: 'FT26100400001', someNewSePayField: 'kept',
  });
  check('A full SePay payload with an unknown extra field is accepted and matched',
    fullPayload.status === 200 && fullPayload.body.result === 'MATCHED', JSON.stringify(fullPayload.body));
  check('That order is paid', (await status(second.orderCode)) === 'PAID');

  const third = await newOrder();
  const outgoing = await send({ id: `out-${Date.now()}`, transferType: 'out', transferAmount: 750000, content: third.reference, accountNumber: shopAccount });
  check('Money going out is ignored even with an order code inside', outgoing.body.result === 'IGNORED');
  const otherAccount = await send({ id: `acc-${Date.now()}`, transferType: 'in', transferAmount: 750000, content: third.reference, accountNumber: '999999999999' });
  check('Money into another linked account is ignored', otherAccount.body.result === 'IGNORED');
  check('Neither moved the order', (await status(third.orderCode)) === 'AWAITING_PAYMENT');

  const over = await send({ id: `over-${Date.now()}`, transferType: 'in', transferAmount: 800000, content: `CK ${third.reference}`, accountNumber: shopAccount });
  check('Paying too much is recorded as overpaid', over.body.result === 'OVERPAID');
  check('An overpaid order is still paid', (await status(third.orderCode)) === 'PAID');
  const flagged = await call(`/admin/orders/${third.orderCode}`, { headers: mgr });
  const flaggedOrder = flagged.body.order ?? flagged.body;
  check('An overpaid order is flagged for a refund of the difference',
    flaggedOrder.needsAttention === true && String(flaggedOrder.attentionNote).includes('50000'), flaggedOrder.attentionNote);

  const late = await send({ id: `late-${Date.now()}`, transferType: 'in', transferAmount: 1500000, content: reference });
  check('A second payment for a paid order is recorded as late', late.body.result === 'LATE');

  const noId = await send({ transferAmount: 750000, content: third.reference });
  check('A notification without a transaction id is rejected', noId.status === 400);
  const fraction = await send({ id: `fr-${Date.now()}`, transferAmount: 1000.5, content: third.reference });
  check('A fractional amount is rejected instead of crashing', fraction.status === 400);

  // --- Reconciliation ---
  const customerReconcile = await call('/payments/reconcile', { method: 'POST', headers: auth, body: '{}' });
  check('A customer cannot reconcile', customerReconcile.status === 403);
  const reconcile = await call('/payments/reconcile', { method: 'POST', headers: mgr, body: JSON.stringify({ days: 1 }) });
  check('Reconciling answers clearly whether SePay is configured',
    reconcile.status === 200 || reconcile.status === 424, `${reconcile.status} ${JSON.stringify(reconcile.body?.message ?? '')}`);

  const log = await call('/payments/log?limit=20', { headers: mgr });
  const row = (log.body ?? []).find((one) => one.referenceCode === 'FT26100400001');
  check('The log keeps the bank reference and the raw payload', Boolean(row) && row.rawData?.someNewSePayField === 'kept');

  console.log('='.repeat(64));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
