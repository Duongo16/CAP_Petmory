/**
 * Kiem thu nghiep vu mua hang co san o nhung cho de sai: bam dat hai lan,
 * hai nguoi doi trang thai cung luc, so luong trong gio vuot kho, gia va trang
 * thai mon hang doi giua luc them vao gio va luc dat, khach tu huy don, va tien
 * ve cho mot don da huy.
 *
 * Bai nay tu tao mot mon hang rieng, nen khong lam xo lech hang mau.
 *
 * Chay: node tools/test-goods-flow-api.js
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const WEBHOOK_KEY = process.env.PETMORY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const PASSWORD = 'Password@123';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const CODE = `T-${STAMP}`;
const SKU = 'TEST-A';
const DELIVERY = {
  fullName: 'Khach thu nghiep vu',
  phone: '0912345678',
  address: '12 Duong Thu Nghiem',
  province: 'Ha Noi',
};

let failed = 0;
let passed = 0;
function ok(name, good, note = '') {
  if (good) {
    passed += 1;
  } else {
    failed += 1;
  }
  console.log(`  ${good ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

async function call(where, options = {}) {
  const answer = await fetch(`${API}${where}`, options);
  const text = await answer.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: answer.status, body, text };
}

const asJson = (token, data, method = 'POST') => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(data),
});

const withToken = (token) => ({ headers: { authorization: `Bearer ${token}` } });

async function signIn(who) {
  const answer = await call('/auth/login', asJson(null, who));
  return answer.body.accessToken;
}

async function makeCustomer(tag) {
  const made = await call('/auth/register', asJson(null, {
    email: `luong.${tag}.${STAMP}@petmory.local`, password: PASSWORD, fullName: `Khach ${tag}`,
  }));
  return made.body.accessToken;
}

async function stockNow() {
  const one = await call(`/admin/goods/${CODE}`, withToken(BOSS_TOKEN));
  return one.body?.variant?.find((each) => each.sku === SKU)?.stock ?? -1;
}

/** Dat ton kho ve dung mot con so, bang duong dieu chinh co ly do. */
async function setStock(target) {
  const delta = target - (await stockNow());
  if (delta !== 0) {
    await call(`/admin/goods/${CODE}/stock/${SKU}`,
      asJson(BOSS_TOKEN, { delta, note: 'Dat lai ton de kiem thu' }, 'PATCH'));
  }
}

async function fillCart(token, quantity) {
  await call('/cart', { method: 'DELETE', ...withToken(token) });
  return call('/cart/goods', asJson(token, { goodsCode: CODE, sku: SKU, quantity }));
}

async function placeOrder(token) {
  return call('/orders', asJson(token, DELIVERY));
}

function payFor(orderCode, amount) {
  return call('/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
    body: JSON.stringify({
      id: `luong-${orderCode}-${Math.random().toString(16).slice(2)}`,
      transferAmount: amount,
      content: `CT DEN ${orderCode}`,
    }),
  });
}

function setStatus(orderCode, status, reason = 'Kiem thu') {
  return call(`/admin/orders/${orderCode}/status`, asJson(BOSS_TOKEN, { status, reason }, 'PATCH'));
}

async function adminOrder(orderCode) {
  return (await call(`/admin/orders/${orderCode}`, withToken(BOSS_TOKEN))).body;
}

function money(raw) {
  const text = typeof raw === 'object' && raw !== null ? raw.$numberDecimal : raw;
  return String(text ?? '0').split('.')[0];
}

let BOSS_TOKEN = '';

async function run() {
  console.log('NGHIEP VU MUA HANG CO SAN');
  console.log('='.repeat(64));

  BOSS_TOKEN = await signIn(BOSS);
  const groups = await call('/goods/categories');
  const made = await call('/admin/goods', asJson(BOSS_TOKEN, {
    code: CODE,
    name: `Mon thu nghiem ${STAMP}`,
    category: groups.body[0]._id,
    optionNames: ['Loai'],
    deliveryDays: 2,
    variant: [{ sku: SKU, optionValues: ['A'], price: '50000', stock: 10 }],
  }));
  ok('Tao duoc mon hang thu nghiem', made.status === 201, String(made.status));

  const opening = await call(`/admin/goods/${CODE}/stock/${SKU}`, withToken(BOSS_TOKEN));
  ok('Ton dau khi tao mon duoc ghi vao lich su kho',
    (opening.body ?? []).some((each) => each.delta === 10 && each.after === 10),
    JSON.stringify((opening.body ?? []).map((each) => each.delta)));

  const a = await makeCustomer('a');
  const b = await makeCustomer('b');

  // --- Bam dat hang hai lan cung luc chi ra mot don ---
  await fillCart(a, 1);
  const twice = await Promise.all([placeOrder(a), placeOrder(a)]);
  const madeCount = twice.filter((one) => one.status === 201).length;
  ok('Bam dat hang hai lan cung luc chi tao mot don', madeCount === 1,
    twice.map((one) => one.status).join(','));
  const firstCode = twice.find((one) => one.status === 201)?.body?.orderCode;

  // --- Nhieu khach dat cung luc van nhan ma don khac nhau ---
  const crowd = await Promise.all(['c1', 'c2', 'c3', 'c4', 'c5'].map((tag) => makeCustomer(tag)));
  await Promise.all(crowd.map((token) => fillCart(token, 1)));
  const rush = await Promise.all(crowd.map((token) => placeOrder(token)));
  const codes = rush.map((one) => one.body?.orderCode).filter(Boolean);
  ok('Nam khach dat cung luc deu thanh cong', rush.every((one) => one.status === 201),
    rush.map((one) => one.status).join(','));
  ok('Ma don cua nhung lan dat cung luc khong trung nhau', new Set(codes).size === codes.length,
    codes.join(','));
  for (const code of codes) {
    await setStatus(code, 'CANCELLED', 'Don don dep sau kiem thu');
  }

  // --- So luong trong gio khong duoc vuot kho ---
  await setStock(3);
  await fillCart(b, 1);
  const cartNow = await call('/cart', withToken(b));
  const lineId = cartNow.body.items[0].id;
  const bump = await call(`/cart/items/${lineId}`, asJson(b, { quantity: 5 }, 'PATCH'));
  ok('Tang so luong trong gio vuot ton kho bi chan', bump.status === 400, String(bump.status));
  const within = await call(`/cart/items/${lineId}`, asJson(b, { quantity: 3 }, 'PATCH'));
  ok('Tang so luong trong gio bang dung ton kho thi duoc', within.status === 200, String(within.status));

  // --- Kho giam sau khi da vao gio thi luc dat bi chan, gio van con ---
  await setStock(2);
  const shortAtCheckout = await placeOrder(b);
  ok('Dat hang khi kho khong con du bi chan', shortAtCheckout.status === 409,
    String(shortAtCheckout.status));
  const cartKept = await call('/cart', withToken(b));
  ok('Dat khong thanh thi gio hang van giu nguyen', (cartKept.body.items ?? []).length === 1,
    String(cartKept.body.items?.length));

  // --- Gia doi giua luc them vao gio va luc dat: don lay gia moi nhat ---
  await setStock(10);
  await fillCart(b, 2);
  await call(`/admin/goods/${CODE}`, asJson(BOSS_TOKEN, {
    variant: [{ sku: SKU, optionValues: ['A'], price: '55000' }],
  }, 'PATCH'));
  const repriced = await placeOrder(b);
  ok('Dat hang sau khi doi gia thi don tinh theo gia moi',
    repriced.status === 201 && money(repriced.body.rows[0].unitPrice) === '55000'
      && money(repriced.body.total) === '110000',
    `${repriced.status} ${money(repriced.body?.rows?.[0]?.unitPrice)} / ${money(repriced.body?.total)}`);

  // --- Mon bi tat sau khi da vao gio thi khong dat duoc ---
  await fillCart(b, 1);
  await call(`/admin/goods/${CODE}`, asJson(BOSS_TOKEN, { enabled: false }, 'PATCH'));
  const offAtCheckout = await placeOrder(b);
  ok('Mon da ngung ban thi khong dat duoc', offAtCheckout.status === 409,
    String(offAtCheckout.status));
  await call(`/admin/goods/${CODE}`, asJson(BOSS_TOKEN, { enabled: true }, 'PATCH'));
  await call('/cart', { method: 'DELETE', ...withToken(b) });

  // --- Hai nguoi xac nhan thanh toan cung luc chi tru kho mot lan ---
  await setStock(10);
  const paidTwice = await Promise.all([setStatus(firstCode, 'PAID'), setStatus(firstCode, 'PAID')]);
  ok('Hai lan xac nhan thanh toan cung luc: mot lan duoc, mot lan bi tu choi',
    paidTwice.filter((one) => one.status === 200).length === 1,
    paidTwice.map((one) => one.status).join(','));
  ok('Hai lan xac nhan thanh toan cung luc chi tru kho mot lan', (await stockNow()) === 9,
    String(await stockNow()));

  // --- Don chi co hang co san di thang tu da thanh toan sang dang giao ---
  const steps = (await adminOrder(firstCode)).nextSteps ?? [];
  ok('Don chi co hang co san duoc chuyen thang sang dang giao', steps.includes('SHIPPING'),
    steps.join(','));

  // --- Hai nguoi huy cung luc chi hoan kho mot lan ---
  const cancelTwice = await Promise.all([setStatus(firstCode, 'CANCELLED'), setStatus(firstCode, 'CANCELLED')]);
  ok('Hai lan huy cung luc: mot lan duoc, mot lan bi tu choi',
    cancelTwice.filter((one) => one.status === 200).length === 1,
    cancelTwice.map((one) => one.status).join(','));
  ok('Hai lan huy cung luc chi hoan kho mot lan', (await stockNow()) === 10,
    String(await stockNow()));

  // --- Khach tu huy don chua thanh toan ---
  await fillCart(a, 1);
  const own = await placeOrder(a);
  const strangerCancel = await call(`/orders/${own.body.orderCode}/cancel`, asJson(b, {}));
  ok('Khach khac khong huy duoc don cua nguoi khac', strangerCancel.status === 404,
    String(strangerCancel.status));
  const selfCancel = await call(`/orders/${own.body.orderCode}/cancel`, asJson(a, {}));
  ok('Khach tu huy duoc don chua thanh toan',
    selfCancel.status === 201 && selfCancel.body?.status === 'CANCELLED',
    `${selfCancel.status} ${selfCancel.body?.status}`);

  // --- Tien ve cho mot don da huy thi duoc danh dau cho nguoi xu ly ---
  await payFor(own.body.orderCode, 50000);
  const late = await adminOrder(own.body.orderCode);
  ok('Tien ve cho don da huy thi don duoc danh dau can xu ly',
    late.order.needsAttention === true && late.order.status === 'CANCELLED',
    `${late.order.needsAttention} ${late.order.status}`);
  ok('Tien ve cho don da huy khong lam tru kho', (await stockNow()) === 10, String(await stockNow()));

  // --- Khach khong huy duoc don da thanh toan ---
  await fillCart(a, 1);
  const paidOwn = await placeOrder(a);
  await payFor(paidOwn.body.orderCode, Number(money(paidOwn.body.total)));
  const cancelPaid = await call(`/orders/${paidOwn.body.orderCode}/cancel`, asJson(a, {}));
  ok('Khach khong tu huy duoc don da thanh toan', cancelPaid.status === 400, String(cancelPaid.status));
  await setStatus(paidOwn.body.orderCode, 'CANCELLED', 'Don dep sau kiem thu');

  // --- Don dep ---
  await call(`/admin/goods/${CODE}`, { method: 'DELETE', ...withToken(BOSS_TOKEN) });

  console.log('='.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
