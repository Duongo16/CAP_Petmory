/**
 * Kiem thu tai khoan nhan tien chot trong don (SOW muc 13): moi don luu tai
 * khoan nhan tien luc dat, va ma QR doc tu tai khoan da chot do, nen doi tai
 * khoan trong cau hinh sau nay khong lam doi QR cua cac don dang cho.
 * Run: node tools/test-payee-api.js
 */
const { addCustomLine } = require('./lib/made-to-order');

const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

let failed = 0;
function check(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
}

const post = (path, body, token) => fetch(`${API}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
}).then((res) => res.json());
const get = (path, token) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((res) => res.json());

async function run() {
  console.log('ORDER PAYEE SNAPSHOT TEST');
  console.log('='.repeat(64));
  const made = await post('/auth/register', { email: `payee.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Payee test' });
  await addCustomLine(made.accessToken, { productTypeCode: 'PT-02', sizeCode: 'KEY-S' });
  const order = await post('/orders', { fullName: 'Payee Test', phone: '0901234567', address: '1 Duong', province: 'Hue' }, made.accessToken);
  const manager = (await post('/auth/login', MANAGER)).accessToken;
  const settings = await get('/settings', manager);
  const detail = await get(`/admin/orders/${order.orderCode}`, manager);
  const payee = (detail.order ?? detail).payee;
  check('The order keeps the receiving account from when it was placed',
    payee?.accountNumber === settings.accountNumber && payee?.accountHolder === settings.accountHolder);
  const qr = await get(`/payments/qr/${order.orderCode}`, made.accessToken);
  check('The QR code is built from the account kept in the order', qr.accountNumber === payee?.accountNumber && Boolean(qr.qrImage));
  console.log('='.repeat(64));
  console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
