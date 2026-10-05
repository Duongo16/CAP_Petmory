const { addCustomLine } = require('./lib/made-to-order');
/**
 * Internal operations API test: order list, filtering, search, status changes,
 * customer profiles and the permission split between the three internal groups.
 * Run: node tools/test-admin-api.js
 */
const API = 'http://localhost:3000/api';
const WEBHOOK_KEY = 'change-this-key-before-running';
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

/** Creates a new customer with one paid order and returns the fixtures to assert on. */
async function makeCustomerWithOrder(fullName) {
  const email = `qt.${Date.now()}.${Math.floor(Math.random() * 1000)}@petmory.local`;
  const dk = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123', fullName }),
  });
  const token = dk.body.accessToken;

  await addCustomLine(token, { productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1 });
  const order = await call('/orders', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      fullName,
      phone: '0901234567',
      address: '12 Duong ABC',
      province: 'Ha Noi',
    }),
  });
  return { email, token, orderCode: order.body.orderCode, customerId: dk.body.user.id };
}

async function returnMoney(orderCode, amount) {
  return call('/payments/webhook', {
    method: 'POST',
    headers: { Authorization: `Apikey ${WEBHOOK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `qt-${Date.now()}-${Math.random()}`,
      transferAmount: amount,
      content: `CT DEN ${orderCode}`,
    }),
  });
}

async function run() {
  console.log('INTERNAL OPERATIONS API TEST');
  console.log('='.repeat(66));

  const managerToken = await login('quanly@petmory.local', PASSWORD_INTERNAL);
  const workshopToken = managerToken;
  const supportToken = await login('cskh@petmory.local', PASSWORD_INTERNAL);
  check('Hai tai khoan noi bo deu dang nhap duoc', Boolean(managerToken && supportToken));

  const customer = await makeCustomerWithOrder('Nguyen Van Kiem Thu');
  await returnMoney(customer.orderCode, 250000);

        // --- Dispatch board ---
  const stats = await call('/admin/orders/stats', { headers: authHeaders(managerToken) });
  check('Reads the counts per status', stats.status === 200 && stats.body.PAID >= 1,
    `paid = ${stats.body?.PAID}`);
  check('The counts list all six statuses', Object.keys(stats.body ?? {}).length === 6,
    `${Object.keys(stats.body ?? {}).length} statuses`);

        // --- List and filters ---
  const orderList = await call('/admin/orders', { headers: authHeaders(managerToken) });
  check('Lists the orders of every customer', orderList.status === 200 && orderList.body.total >= 1,
    `total = ${orderList.body?.total}`);
  check('Carries the full paging details',
    orderList.body.page === 1 && orderList.body.pageSize === 20 && orderList.body.pageCount >= 1);

  const filter = await call('/admin/orders?status=PAID', { headers: authHeaders(managerToken) });
  check('Filtering by status returns only that status',
    filter.body.rows.every((d) => d.status === 'PAID'),
    `${filter.body.rows.length} orders`);

  const filterUnknown = await call('/admin/orders?status=STATUS_NOT_SIZE', { headers: authHeaders(managerToken) });
  check('A status outside the list is rejected', filterUnknown.status === 400, String(filterUnknown.status));

  const findCode = await call(`/admin/orders?keyword=${customer.orderCode}`, { headers: authHeaders(managerToken) });
  check('Search by order code', findCode.body.total === 1 && findCode.body.rows[0].orderCode === customer.orderCode);

  const findName = await call('/admin/orders?keyword=Nguyen%20Van%20Kiem%20Thu', {
    headers: authHeaders(managerToken),
  });
  check('Search by recipient name', findName.body.total >= 1, `${findName.body?.total} orders`);

        // A keyword with special characters must not turn itself into a search pattern
  const searchTrap = await call('/admin/orders?keyword=.*', { headers: authHeaders(managerToken) });
  check('Special characters in a keyword are neutralised', searchTrap.body.total === 0,
    `returned ${searchTrap.body?.total} orders`);

  const onePage = await call('/admin/orders?pageSize=1', { headers: authHeaders(managerToken) });
  check('Caps the number of rows per page', onePage.body.rows.length === 1 && onePage.body.pageSize === 1);

  const tooMany = await call('/admin/orders?pageSize=500', { headers: authHeaders(managerToken) });
  check('Rejects a request for too many rows', tooMany.status === 400, String(tooMany.status));

        // --- Order detail ---
  const ct = await call(`/admin/orders/${customer.orderCode}`, { headers: authHeaders(managerToken) });
  check('Order detail carries the customer details', ct.body?.customer?.email === customer.email);
  check('Order detail suggests the right next steps',
    JSON.stringify(ct.body?.nextSteps) === JSON.stringify(['IN_PRODUCTION', 'CANCELLED']),
    JSON.stringify(ct.body?.nextSteps));
  check('Order detail never leaks the password hash', !JSON.stringify(ct.body.customer).includes('password'));

  const notSize = await call('/admin/orders/PM000000999', { headers: authHeaders(managerToken) });
  check('A missing order returns not found', notSize.status === 404, String(notSize.status));

        // --- Status changes ---
  const skipStep = await call(`/admin/orders/${customer.orderCode}/status`, {
    method: 'PATCH', headers: authHeaders(managerToken),
    body: JSON.stringify({ status: 'COMPLETED', reason: 'trying to skip ahead' }),
  });
  check('Rejects an illegal transition', skipStep.status === 400, String(skipStep.status));

  const money = await call(`/admin/orders/${customer.orderCode}/status`, {
    method: 'PATCH', headers: authHeaders(workshopToken),
    body: JSON.stringify({ status: 'IN_PRODUCTION', reason: 'workshop took the order' }),
  });
  check('A workshop dispatcher can move the status',
    money.status === 200 && money.body.order.status === 'IN_PRODUCTION',
    money.body?.order?.status);
  check('After a move the next steps change too',
    JSON.stringify(money.body?.nextSteps) === JSON.stringify(['SHIPPING', 'CANCELLED']),
    JSON.stringify(money.body?.nextSteps));

  const writeLabel = (money.body?.history ?? []).find((x) => x.action === 'ORDER_STATUS_CHANGED');
  check('A status change writes history with the reason',
    Boolean(writeLabel) && writeLabel.reason === 'workshop took the order',
    writeLabel ? writeLabel.reason : 'no entry found');
  check('History records who did it',
    writeLabel?.actor?.email === 'quanly@petmory.local',
    writeLabel?.actor?.email);
  check('History also covers the order being created',
    (money.body?.history ?? []).some((x) => x.action === 'ORDER_CREATED'));

        // --- Customer profile ---
  const customerList = await call(`/admin/customers?keyword=${customer.email}`, { headers: authHeaders(managerToken) });
  check('A customer can be found by email', customerList.body.total === 1 && customerList.body.rows[0].countOrder === 1,
    `orders = ${customerList.body?.rows?.[0]?.countOrder}`);
  check('The customer list never returns the password hash',
    !JSON.stringify(customerList.body.rows).includes('password'));

  const profile = await call(`/admin/customers/${customer.customerId}`, { headers: authHeaders(managerToken) });
  check('A customer profile carries their order history', profile.body.orders.length === 1);
  check('A customer profile carries their pets', Array.isArray(profile.body.pet));

  const badId = await call('/admin/customers/not-right-code', { headers: authHeaders(managerToken) });
  check('A malformed customer id returns not found', badId.status === 404, String(badId.status));

        // --- Permissions ---
  const supportRead = await call('/admin/orders', { headers: authHeaders(supportToken) });
  check('The support desk can read the order list', supportRead.status === 200 && supportRead.body.total >= 1,
    String(supportRead.status));

  const supportDetail = await call(`/admin/orders/${customer.orderCode}`, { headers: authHeaders(supportToken) });
  check('The support desk can open one order', supportDetail.status === 200, String(supportDetail.status));

  const supportWrite = await call(`/admin/orders/${customer.orderCode}/status`, {
    method: 'PATCH', headers: authHeaders(supportToken),
    body: JSON.stringify({ status: 'SHIPPING' }),
  });
  check('The support desk cannot change a status', supportWrite.status === 403,
    String(supportWrite.status));

  const customerRead = await call('/admin/orders', { headers: authHeaders(customer.token) });
  check('A customer cannot reach the operations screens', customerRead.status === 403,
    String(customerRead.status));

  const customerReadOther = await call(`/admin/customers/${customer.customerId}`, {
    headers: authHeaders(customer.token),
  });
  check('A customer cannot read another profile', customerReadOther.status === 403,
    String(customerReadOther.status));

  const notLogin = await call('/admin/orders');
  check('Signed out requests are rejected', notLogin.status === 401, String(notLogin.status));

  console.log('='.repeat(66));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
