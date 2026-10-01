/**
 * Kiem thu ba bao cao quan tri (Phu luc 01 muc 22).
 *
 * Trong tam la hai dieu: doanh thu chi dem don da thanh toan tro di, va doi
 * don gia tri tue nhan tao khong duoc lam doi so lieu ky da qua. Ca hai deu
 * duoc kiem bang cach tao du lieu that roi doc lai bao cao.
 *
 * Chay: node tools/test-reports-api.js
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const WEBHOOK_KEY = process.env.PETMORY_WEBHOOK_KEY ?? 'change-this-key-before-running';
const PASSWORD = 'Password@123';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const ACCOUNT_ADMIN = { email: 'quantri@petmory.local', password: 'Petmory@2026' };

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
  return (await call('/auth/login', asJson(null, who))).body.accessToken;
}

/** Dat mot don chi gom hang co san, roi tra ve ma don va so tien. */
async function orderGoods(token, goodsCode, sku, quantity) {
  await call('/cart', { method: 'DELETE', ...withToken(token) });
  await call('/cart/goods', asJson(token, { goodsCode, sku, quantity }));
  const order = await call('/orders', asJson(token, {
    fullName: 'Khach bao cao',
    phone: '0912345678',
    address: '9 Duong Bao Cao',
    province: 'Ha Noi',
  }));
  const total = Number(order.body.total?.$numberDecimal ?? order.body.total);
  return { code: order.body.orderCode, total };
}

function payFor(orderCode, amount) {
  return call('/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
    body: JSON.stringify({
      id: `bc-${orderCode}-${Math.random().toString(16).slice(2)}`,
      transferAmount: amount,
      content: `CT DEN ${orderCode}`,
    }),
  });
}

/**
 * Chay mot lan phuc hoi anh that.
 *
 * Day la luot dung tri tue nhan tao duy nhat dang chay that trong he thong,
 * nen dung no de kiem dieu quan trong nhat cua bao cao chi phi: don gia phai
 * duoc chep vao luot dung, khong duoc tra sang tham so nghiep vu.
 */
async function useAiOnce(token) {
  const pet = await call('/pets', asJson(token, { name: `Be bao cao ${STAMP}`, kind: 'DOG' }));
  const dots = Buffer.alloc(900 * 700 * 3);
  for (let i = 0; i < dots.length; i += 3) {
    const bright = (i / 3) % 7 < 3 ? 220 : 70;
    dots[i] = bright;
    dots[i + 1] = bright - 20;
    dots[i + 2] = bright - 50;
  }
  const bytes = await sharp(dots, { raw: { width: 900, height: 700, channels: 3 } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'anh.png');
  const sent = await fetch(`${API}/pet-photos/${pet.body._id}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const photo = await sent.json();
  return call(`/pet-photos/${photo._id}/restore`, asJson(token, {
    operation: ['SHARPEN'],
  }));
}

/** Khoang thoi gian hep, chi bao trum lan chay nay. */
function windowNow(minutesBack = 10) {
  const to = new Date(Date.now() + 60_000).toISOString();
  const from = new Date(Date.now() - minutesBack * 60_000).toISOString();
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
}

async function run() {
  console.log('BAO CAO QUAN TRI: DOANH THU, CHI PHI AI, TIEN DO');
  console.log('='.repeat(64));

  const boss = await signIn(BOSS);
  const workshop = await signIn(ACCOUNT_ADMIN);
  const email = `bc.${STAMP}@petmory.local`;
  const mine = (await call('/auth/register', asJson(null, {
    email, password: PASSWORD, fullName: 'Khach bao cao',
  }))).body.accessToken;

  const span = windowNow();
  const before = (await call(`/admin/reports/revenue?${span}`, withToken(boss))).body;
  ok('Doc duoc bao cao doanh thu', before && typeof before.total === 'string',
    String(before?.total));

  // --- NT-22.1 Ba don da thanh toan va mot don chua ---
  const paid = [];
  for (let i = 0; i < 3; i += 1) {
    const one = await orderGoods(mine, 'G-HOP-QUA', 'HOP-NHO', 1);
    await payFor(one.code, one.total);
    paid.push(one);
  }
  const unpaid = await orderGoods(mine, 'G-HOP-QUA', 'HOP-NHO', 1);

  const after = (await call(`/admin/reports/revenue?${span}`, withToken(boss))).body;
  const grew = BigInt(after.total) - BigInt(before.total);
  const wanted = BigInt(paid.reduce((sum, one) => sum + one.total, 0));
  ok('Doanh thu chi cong ba don da thanh toan', grew === wanted,
    `tang ${grew}, mong doi ${wanted}`);
  ok('Don chua thanh toan khong duoc tinh vao doanh thu',
    grew === wanted, `don chua tra: ${unpaid.total}`);

  // --- NT-22.2 Huy mot don thi doanh thu giam dung gia tri don do ---
  await call(`/admin/orders/${paid[0].code}/status`,
    asJson(boss, { status: 'CANCELLED', reason: 'Khach doi y' }, 'PATCH'));
  const afterCancel = (await call(`/admin/reports/revenue?${span}`, withToken(boss))).body;
  ok('Huy mot don thi doanh thu giam dung gia tri don do',
    BigInt(after.total) - BigInt(afterCancel.total) === BigInt(paid[0].total),
    `${after.total} -> ${afterCancel.total}, don ${paid[0].total}`);

  // --- NT-22.3 Tong theo san pham bang tong theo nhom hang ---
  const sumKind = afterCancel.byKind.reduce((sum, one) => sum + BigInt(one.amount), 0n);
  const sumProduct = afterCancel.byProduct.reduce((sum, one) => sum + BigInt(one.amount), 0n);
  ok('Tong theo nhom hang bang tong chung', sumKind === BigInt(afterCancel.total),
    `${sumKind} / ${afterCancel.total}`);
  ok('Tong theo san pham bang tong theo nhom hang', sumProduct === sumKind,
    `${sumProduct} / ${sumKind}`);
  ok('Doanh thu tach duoc hai dong hang',
    afterCancel.byKind.some((one) => one.name === 'READY_MADE'),
    afterCancel.byKind.map((one) => one.name).join(','));
  ok('Moi con so tien deu la so nguyen, khong co phan le',
    afterCancel.byProduct.every((one) => !one.amount.includes('.')),
    afterCancel.byProduct.map((one) => one.amount).join(','));

  // --- NT-22.4 Doi don gia AI khong lam doi so lieu ky da qua ---
  await call('/settings', asJson(boss, { aiUnitPrice: { restorePhoto: '1000' } }, 'PATCH'));
  /*
   * Do muc tang chu khong do con so tuyet doi.
   *
   * Cac lan chay truoc cung de lai luot dung trong cung khoang thoi gian, va
   * chung mang don gia khac. Do muc tang moi tach duoc ra dung phan cua lan
   * chay nay.
   */
  const costBefore = (await call(`/admin/reports/ai-cost?${span}`, withToken(boss))).body;
  const restored = await useAiOnce(mine);
  ok('Chay duoc mot luot phuc hoi anh that', restored.status === 201,
    `${restored.status} ${restored.text.slice(0, 90)}`);

  const priceOne = (await call(`/admin/reports/ai-cost?${span}`, withToken(boss))).body;
  const rowBefore = costBefore.rows.find((one) => one.kind === 'restorePhoto');
  const restoreRow = priceOne.rows.find((one) => one.kind === 'restorePhoto');
  ok('Luot dung duoc ghi vao bao cao chi phi',
    restoreRow.count === rowBefore.count + 1,
    `${rowBefore.count} -> ${restoreRow.count}`);
  // Don gia vua dat o tren la 1000, nen mot luot dung phai lam chi phi tang dung 1000.
  ok('Chi phi tinh dung theo don gia luc dung',
    BigInt(restoreRow.cost) - BigInt(rowBefore.cost) === 1000n,
    `${rowBefore.cost} -> ${restoreRow.cost}`);

  await call('/settings', asJson(boss, { aiUnitPrice: { restorePhoto: '9000' } }, 'PATCH'));
  const priceTwo = (await call(`/admin/reports/ai-cost?${span}`, withToken(boss))).body;
  ok('Doi don gia AI khong lam doi so lieu ky da qua',
    priceOne.total === priceTwo.total && priceTwo.total !== '0',
    `${priceOne.total} -> ${priceTwo.total}`);

  const later = await useAiOnce(mine);
  ok('Luot dung sau khi doi gia thi tinh theo gia moi', later.status === 201,
    String(later.status));
  const priceThree = (await call(`/admin/reports/ai-cost?${span}`, withToken(boss))).body;
  ok('Tong chi phi tang dung bang don gia moi',
    BigInt(priceThree.total) - BigInt(priceTwo.total) === 9000n,
    `${priceTwo.total} -> ${priceThree.total}`);
  ok('Bao cao chi phi AI liet ke du bon loai luot dung',
    priceTwo.rows.length === 4, String(priceTwo.rows?.length));
  ok('Chi phi AI la so nguyen dong', !String(priceTwo.total).includes('.'),
    String(priceTwo.total));
  await call('/settings', asJson(boss, { aiUnitPrice: { restorePhoto: '0' } }, 'PATCH'));

  // --- NT-22.5 Don qua ngay giao ma chua giao thi tinh la tre han ---
  const progress = (await call('/admin/reports/progress', withToken(boss))).body;
  ok('Bao cao tien do liet ke du sau trang thai', progress.byStatus.length === 6,
    String(progress.byStatus?.length));
  ok('Bao cao tien do dem duoc so don tre han',
    typeof progress.lateCount === 'number', String(progress.lateCount));
  ok('Moi don trong danh sach tre deu chua o trang thai da giao',
    (progress.late ?? []).every((one) => !['COMPLETED', 'CANCELLED'].includes(one.status)),
    (progress.late ?? []).map((one) => one.status).join(','));
  ok('Moi don trong danh sach tre deu da qua ngay giao du kien',
    (progress.late ?? []).every((one) => new Date(one.estimatedDelivery) < new Date()));

  // --- NT-22.6 Tep CSV mo bang Excel khong vo tieng Viet ---
  const csv = await fetch(`${API}/admin/reports/revenue.csv?${span}`, withToken(boss));
  const bytes = Buffer.from(await csv.arrayBuffer());
  ok('Tai duoc tep CSV bao cao doanh thu', csv.status === 200, String(csv.status));
  ok('Tep CSV co dau nhan dau tep cho Excel',
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    [...bytes.slice(0, 3)].join(','));
  ok('Tep CSV giu nguyen tieng Viet co dau',
    bytes.toString('utf8').includes('Thành tiền'),
    bytes.toString('utf8').split('\r\n')[0]);
  ok('Tep CSV duoc gui ve dang tep tai xuong',
    (csv.headers.get('content-disposition') ?? '').includes('attachment'),
    csv.headers.get('content-disposition') ?? '');

  const costCsv = await fetch(`${API}/admin/reports/ai-cost.csv?${span}`, withToken(boss));
  ok('Tai duoc tep CSV chi phi AI', costCsv.status === 200, String(costCsv.status));
  const progressCsv = await fetch(`${API}/admin/reports/progress.csv`, withToken(boss));
  ok('Tai duoc tep CSV tien do san xuat', progressCsv.status === 200, String(progressCsv.status));

  // --- NT-22.7 Phan quyen ---
  const workshopRevenue = await call('/admin/reports/revenue', withToken(workshop));
  ok('Quan tri vien khong mo duoc bao cao doanh thu', workshopRevenue.status === 403,
    String(workshopRevenue.status));
  const workshopCost = await call('/admin/reports/ai-cost', withToken(workshop));
  ok('Quan tri vien khong mo duoc bao cao chi phi', workshopCost.status === 403,
    String(workshopCost.status));
  const workshopProgress = await call('/admin/reports/progress', withToken(workshop));
  ok('Quan tri vien khong mo duoc bao cao tien do', workshopProgress.status === 403,
    String(workshopProgress.status));
  const plain = await call('/admin/reports/progress', withToken(mine));
  ok('Khach thuong khong mo duoc bao cao nao', plain.status === 403, String(plain.status));
  const signedOut = await call('/admin/reports/revenue');
  ok('Chua dang nhap thi khong mo duoc bao cao', signedOut.status === 401,
    String(signedOut.status));

  // --- Khoang thoi gian nguoc bi tu choi ---
  const backwards = await call(
    `/admin/reports/revenue?from=${encodeURIComponent(new Date().toISOString())}` +
      `&to=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`,
    withToken(boss),
  );
  ok('Khoang thoi gian nguoc bi tu choi', backwards.status === 400, String(backwards.status));

  console.log('='.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
