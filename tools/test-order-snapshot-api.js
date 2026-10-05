/**
 * Kiem thu ban chup thiet ke trong don (SOW muc 7, 11): khach sua anh xem truoc
 * cua ban thiet ke sau khi dat hang thi ho so xuong van hien anh luc dat.
 * Run: node tools/test-order-snapshot-api.js
 */
const sharp = require('sharp');

const API = 'http://localhost:3000/api';
const MANAGER = { email: 'quanly@petmory.local', password: 'Petmory@2026' };

let failed = 0;
function check(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
}

async function json(res) {
  return res.json().catch(() => ({}));
}

/** Mot anh PNG mot mau, de phan biet anh cu va anh moi bang mau diem anh. */
function square(r, g, b) {
  return sharp({ create: { width: 200, height: 200, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

async function upload(token, designId, angle, buffer) {
  const form = new FormData();
  form.append('angle', angle);
  form.append('file', new Blob([buffer], { type: 'image/png' }), `${angle}.png`);
  return fetch(`${API}/designs/${designId}/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
}

async function firstPixel(buffer) {
  const raw = await sharp(buffer).raw().toBuffer();
  return [raw[0], raw[1], raw[2]];
}

async function run() {
  console.log('ORDER DESIGN SNAPSHOT TEST');
  console.log('='.repeat(64));
  const made = await json(await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `chup.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Ban chup test' }),
  }));
  const token = made.accessToken;
  const head = { 'content-type': 'application/json', Authorization: `Bearer ${token}` };
  const design = await json(await fetch(`${API}/designs`, {
    method: 'POST', headers: head,
    body: JSON.stringify({ name: 'Ban chup', modelCode: 'BASE-DOG-STAND', productTypeCode: 'PT-01', sizeCode: 'FIG-M' }),
  }));
  const first = await upload(token, design._id, 'FRONT', await square(200, 30, 30));
  check('The first preview is uploaded', first.ok, String(first.status));
  await fetch(`${API}/cart/items`, { method: 'POST', headers: head, body: JSON.stringify({ productTypeCode: 'PT-01', sizeCode: 'FIG-M', quantity: 1, designId: design._id }) });
  const order = await json(await fetch(`${API}/orders`, {
    method: 'POST', headers: head,
    body: JSON.stringify({ fullName: 'Ban Chup Test', phone: '0901234567', address: '3 Duong Chup', province: 'Vinh' }),
  }));
  check('The order is placed', Boolean(order.orderCode), order.orderCode);

  const again = await upload(token, design._id, 'FRONT', await square(30, 30, 200));
  check('The customer changes the preview after ordering', again.ok, String(again.status));

  const manager = (await json(await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(MANAGER) }))).accessToken;
  const file = await json(await fetch(`${API}/admin/orders/${order.orderCode}/production-file`, { headers: { Authorization: `Bearer ${manager}` } }));
  const rowIndex = file.items?.[0]?.rowIndex;
  check('The production file tells which order row each item is', Number.isInteger(rowIndex), String(rowIndex));
  const shown = await fetch(`${API}/admin/orders/${order.orderCode}/rows/${rowIndex}/preview/FRONT`, { headers: { Authorization: `Bearer ${manager}` } });
  const pixel = shown.ok ? await firstPixel(Buffer.from(await shown.arrayBuffer())) : [0, 0, 0];
  check('The workshop sees the preview from when the order was placed', pixel[0] > 150 && pixel[2] < 80, pixel.join(','));
  const asCustomer = await fetch(`${API}/admin/orders/${order.orderCode}/rows/${rowIndex}/preview/FRONT`, { headers: { Authorization: `Bearer ${token}` } });
  check('A customer cannot open the workshop preview path', asCustomer.status === 403, String(asCustomer.status));
  const missing = await fetch(`${API}/admin/orders/${order.orderCode}/rows/9/preview/FRONT`, { headers: { Authorization: `Bearer ${manager}` } });
  check('A row that does not exist is not found', missing.status === 404, String(missing.status));

  console.log('='.repeat(64));
  console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
