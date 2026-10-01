/**
 * Kiem thu dong hang co san (Phu luc 01 muc 23, Dieu 2).
 *
 * Trong tam la ton kho: chi tru khi da thanh toan, cong lai khi huy, va hai
 * don cung thanh toan cho mon cuoi cung thi chi mot don duoc ghi nhan con don
 * kia bi danh dau cho nguoi that xu ly. Moi con so deu duoc doc lai tu may
 * chu sau khi thao tac, khong tin vao cau tra loi cua chinh lenh vua goi.
 *
 * Chay: node tools/test-goods-api.js
 */
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
  const answer = await call('/auth/login', asJson(null, who));
  return answer.body.accessToken;
}

async function makeCustomer(tag) {
  const email = `hang.${tag}.${STAMP}@petmory.local`;
  const made = await call('/auth/register', asJson(null, {
    email, password: PASSWORD, fullName: `Khach hang ${tag}`,
  }));
  return made.body.accessToken;
}

/** Dat mot don chi gom hang co san, roi tra ve ma don. */
async function orderGoods(token, goodsCode, sku, quantity) {
  await call('/cart', { method: 'DELETE', ...withToken(token) });
  const added = await call('/cart/goods', asJson(token, { goodsCode, sku, quantity }));
  if (added.status !== 201 && added.status !== 200) {
    return { code: null, added };
  }
  const order = await call('/orders', asJson(token, {
    fullName: 'Khach mua hang co san',
    phone: '0912345678',
    address: '12 Duong Hang Hoa',
    province: 'Ha Noi',
  }));
  return { code: order.body?.orderCode ?? null, added, order };
}

/** Bao cho may chu biet tien da ve, dung duong ma ngan hang goi vao. */
function payFor(orderCode, amount) {
  return call('/payments/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Apikey ${WEBHOOK_KEY}` },
    body: JSON.stringify({
      id: `hang-${orderCode}-${Math.random().toString(16).slice(2)}`,
      transferAmount: amount,
      content: `CT DEN ${orderCode}`,
    }),
  });
}

/** So luong con lai cua mot to hop, doc tu may chu. */
async function stockOf(goodsCode, sku) {
  const one = await call(`/goods/${goodsCode}`);
  return one.body?.variant?.find((each) => each.sku === sku)?.stock ?? -1;
}

/**
 * So tien phai tra cho mot don, doc lai tu chinh don do.
 *
 * Doc tu may chu chu khong viet cung mot con so vao bai kiem, vi gia trong
 * danh muc do nhom Quan ly dat va co the da doi. Viet cung mot con so thi den
 * luc gia doi, bai kiem bao hong o buoc tru kho trong khi cho hong that su la
 * so tien da tra.
 */
async function amountOf(orderCode, token) {
  const one = await call(`/orders/${orderCode}`, withToken(token));
  const raw = one.body?.total;
  const text = typeof raw === 'object' && raw !== null ? raw.$numberDecimal : raw;
  return Number(String(text ?? 0).split('.')[0]);
}

async function run() {
  console.log('HANG CO SAN: DANH MUC, TON KHO, MUA HANG');
  console.log('='.repeat(64));

  const boss = await signIn(BOSS);
  const support = await signIn(ACCOUNT_ADMIN);
  const mine = await makeCustomer('a');
  const other = await makeCustomer('b');

  // --- Danh muc tach rieng voi hang tuy bien ---
  const groups = await call('/goods/categories');
  ok('Danh muc nhom hang doc duoc khi chua dang nhap',
    groups.status === 200 && groups.body.length >= 4, String(groups.body?.length));
  const list = await call('/goods');
  ok('Danh sach hang co san doc duoc khi chua dang nhap',
    list.status === 200 && list.body.total >= 6, String(list.body?.total));
  const madeToOrder = await call('/catalog/products');
  ok('Danh muc hang tuy bien khong lan sang hang co san',
    (madeToOrder.body ?? []).every((one) => !String(one.code).startsWith('G-')),
    (madeToOrder.body ?? []).map((one) => one.code).join(','));

  // --- Loc va tim kiem ---
  const byGroup = await call('/goods?category=DO-DUNG');
  ok('Loc duoc theo nhom hang',
    byGroup.body.rows.length >= 2 && byGroup.body.rows.every((one) => one.category.code === 'DO-DUNG'),
    String(byGroup.body?.rows?.length));
  const byWord = await call('/goods?keyword=' + encodeURIComponent('bát'));
  ok('Tim duoc theo ten', byWord.body.total >= 1, String(byWord.body?.total));

  // --- NT-23.1 Hai to hop, hai gia khac nhau ---
  const one = await call('/goods/G-VONG-LEN');
  const small = one.body.variant.find((each) => each.sku === 'VONG-S-NAU');
  const medium = one.body.variant.find((each) => each.sku === 'VONG-M-NAU');
  ok('Moi to hop co gia rieng',
    small.price.$numberDecimal === '180000' && medium.price.$numberDecimal === '210000',
    `${small.price.$numberDecimal} / ${medium.price.$numberDecimal}`);
  ok('Gia la so nguyen dong, khong phan le',
    one.body.variant.every((each) => !each.price.$numberDecimal.includes('.')),
    one.body.variant.map((each) => each.price.$numberDecimal).join(','));
  ok('Moi to hop co ton kho rieng',
    small.stock !== medium.stock, `${small.stock} / ${medium.stock}`);

  // --- NT-23.2 To hop het hang thi khong them vao gio duoc ---
  const soldOut = one.body.variant.find((each) => each.sku === 'VONG-M-TIM');
  ok('Co mot to hop dang het hang', soldOut.stock === 0, String(soldOut?.stock));
  const tryOut = await call('/cart/goods', asJson(mine, {
    goodsCode: 'G-VONG-LEN', sku: 'VONG-M-TIM', quantity: 1,
  }));
  ok('To hop het hang khong them vao gio duoc', tryOut.status === 400, String(tryOut.status));

  const tooMany = await call('/cart/goods', asJson(mine, {
    goodsCode: 'G-BAT-AN', sku: 'BAT-300', quantity: 99,
  }));
  ok('Dat nhieu hon so hang trong kho bi chan', tooMany.status === 400, String(tooMany.status));

  // --- NT-23.3 Tru kho dung mot, va chi khi da thanh toan ---
  const before = await stockOf('G-BAT-AN', 'BAT-300');
  const placed = await orderGoods(mine, 'G-BAT-AN', 'BAT-300', 1);
  ok('Dat duoc don chi gom hang co san', Boolean(placed.code), String(placed.order?.status));
  ok('Them vao gio chua lam ton kho doi',
    (await stockOf('G-BAT-AN', 'BAT-300')) === before,
    `${before} -> ${await stockOf('G-BAT-AN', 'BAT-300')}`);

  await payFor(placed.code, await amountOf(placed.code, mine));
  const afterPaid = await stockOf('G-BAT-AN', 'BAT-300');
  ok('Thanh toan xong thi ton kho giam dung mot', afterPaid === before - 1,
    `${before} -> ${afterPaid}`);

  // --- NT-23.4 Huy don thi ton kho tro lai ---
  await call(`/admin/orders/${placed.code}/status`,
    asJson(boss, { status: 'CANCELLED', reason: 'Khach doi y' }, 'PATCH'));
  ok('Huy don thi ton kho tro lai nhu cu',
    (await stockOf('G-BAT-AN', 'BAT-300')) === before,
    `${await stockOf('G-BAT-AN', 'BAT-300')} / ${before}`);

  // --- NT-23.5 Hai don cung thanh toan cho mon cuoi cung ---
  await call('/admin/goods/G-THE-TEN/stock/THE-XUONG',
    asJson(boss, { delta: -(await stockOf('G-THE-TEN', 'THE-XUONG')) + 1, note: 'Dat lai ton de kiem thu' }, 'PATCH'));
  ok('Dat duoc ton kho ve dung mot mon',
    (await stockOf('G-THE-TEN', 'THE-XUONG')) === 1,
    String(await stockOf('G-THE-TEN', 'THE-XUONG')));

  const raceOne = await orderGoods(mine, 'G-THE-TEN', 'THE-XUONG', 1);
  const raceTwo = await orderGoods(other, 'G-THE-TEN', 'THE-XUONG', 1);
  ok('Hai khach cung dat duoc mon cuoi cung vao gio',
    Boolean(raceOne.code) && Boolean(raceTwo.code));

  /*
   * Hai lan tra tien phai di cung luc, nen so tien duoc doc truoc roi moi goi,
   * de buoc doc khong lam lech nhau hai lan goi.
   */
  const raceMoney = await Promise.all([
    amountOf(raceOne.code, mine),
    amountOf(raceTwo.code, other),
  ]);
  await Promise.all([payFor(raceOne.code, raceMoney[0]), payFor(raceTwo.code, raceMoney[1])]);

  const leftAfter = await stockOf('G-THE-TEN', 'THE-XUONG');
  ok('Ton kho khong bao gio xuong duoi khong', leftAfter >= 0, String(leftAfter));
  ok('Ton kho con dung khong sau khi ca hai don thanh toan', leftAfter === 0,
    String(leftAfter));

  const seenOne = await call(`/admin/orders/${raceOne.code}`, withToken(boss));
  const seenTwo = await call(`/admin/orders/${raceTwo.code}`, withToken(boss));
  const flagged = [seenOne, seenTwo].filter((each) => each.body.order.needsAttention);
  ok('Dung mot don bi danh dau cho nguoi that xu ly', flagged.length === 1,
    `${seenOne.body.order.needsAttention} / ${seenTwo.body.order.needsAttention}`);
  ok('Don bi danh dau co ghi ro vi sao',
    (flagged[0]?.body.order.attentionNote ?? '').length > 10,
    flagged[0]?.body.order.attentionNote ?? '');

  // --- NT-23.6 Ngay giao lay theo dong hang lau nhat ---
  await call('/cart', { method: 'DELETE', ...withToken(mine) });
  await call('/cart/items', asJson(mine, {
    productTypeCode: 'PT-02', sizeCode: 'KEY-S', quantity: 1,
  }));
  await call('/cart/goods', asJson(mine, {
    goodsCode: 'G-HOP-QUA', sku: 'HOP-NHO', quantity: 1,
  }));
  const mixedCart = await call('/cart', withToken(mine));
  ok('Gio chua duoc ca hai dong hang cung luc',
    mixedCart.body.items.length === 2 &&
      new Set(mixedCart.body.items.map((each) => each.kind)).size === 2,
    mixedCart.body.items.map((each) => each.kind).join(','));

  const madeDays = mixedCart.body.items.find((each) => each.kind === 'MADE_TO_ORDER').productionDays;
  const readyDays = mixedCart.body.items.find((each) => each.kind === 'READY_MADE').productionDays;
  const mixedOrder = await call('/orders', asJson(mine, {
    fullName: 'Khach mua ca hai', phone: '0912345678',
    address: '12 Duong Hang Hoa', province: 'Ha Noi',
  }));
  ok('Ngay giao du kien tinh theo dong hang lau nhat',
    mixedOrder.body.productionDays === Math.max(madeDays, readyDays),
    `${madeDays} / ${readyDays} -> ${mixedOrder.body?.productionDays}`);
  ok('Mot don co ca hai loai chi tra tien mot lan',
    typeof mixedOrder.body.total === 'string' || typeof mixedOrder.body.total === 'object');

  // --- NT-23.8 Ho so san xuat chi liet ke dong tuy bien ---
  await payFor(mixedOrder.body.orderCode, await amountOf(mixedOrder.body.orderCode, mine));
  const profile = await call(`/admin/orders/${mixedOrder.body.orderCode}/production-file`, withToken(boss));
  ok('Ho so san xuat chi liet ke dong hang tuy bien',
    profile.body.items.length === 1, String(profile.body?.items?.length));
  ok('Ho so san xuat van liet ke rieng dong hang co san de dong goi',
    (profile.body.packRows ?? []).length === 1, String(profile.body?.packRows?.length));

  // --- NT-23.7 Don chi co hang co san thi khong co ho so san xuat ---
  const onlyGoods = await orderGoods(other, 'G-HOP-QUA', 'HOP-VUA', 1);
  await payFor(onlyGoods.code, await amountOf(onlyGoods.code, mine));
  const emptyProfile = await call(`/admin/orders/${onlyGoods.code}/production-file`, withToken(boss));
  ok('Don chi co hang co san thi ho so san xuat khong co dong nao',
    (emptyProfile.body.items ?? []).length === 0,
    String(emptyProfile.body?.items?.length));

  // --- NT-23.9 Doi gia khong lam doi don cu ---
  const beforePrice = await call(`/admin/orders/${onlyGoods.code}`, withToken(boss));
  const lineBefore = beforePrice.body.order.rows[0].unitPrice.$numberDecimal;
  await call('/admin/goods/G-HOP-QUA', asJson(boss, {
    variant: [
      { sku: 'HOP-NHO', optionValues: ['Nhỏ'], price: '60000' },
      { sku: 'HOP-VUA', optionValues: ['Vừa'], price: '99000' },
    ],
  }, 'PATCH'));
  const afterPrice = await call(`/admin/orders/${onlyGoods.code}`, withToken(boss));
  ok('Doi gia sau khi khach dat thi don cu giu nguyen gia',
    afterPrice.body.order.rows[0].unitPrice.$numberDecimal === lineBefore,
    `${lineBefore} -> ${afterPrice.body.order.rows[0].unitPrice.$numberDecimal}`);
  const nowPrice = await call('/goods/G-HOP-QUA');
  ok('Gia moi da co hieu luc voi khach mua tu bay gio',
    nowPrice.body.variant.find((each) => each.sku === 'HOP-VUA').price.$numberDecimal === '99000');
  ok('Doi gia khong lam mat ton kho dang co',
    nowPrice.body.variant.find((each) => each.sku === 'HOP-VUA').stock > 0,
    String(nowPrice.body.variant.find((each) => each.sku === 'HOP-VUA').stock));

  // --- NT-23.10 Sua ton kho tay ma bo trong ly do thi bi chan ---
  const noReason = await call('/admin/goods/G-BAT-AN/stock/BAT-600',
    asJson(boss, { delta: 5 }, 'PATCH'));
  ok('Sua ton kho tay ma bo trong ly do thi bi chan', noReason.status === 400,
    String(noReason.status));

  const withReason = await call('/admin/goods/G-BAT-AN/stock/BAT-600',
    asJson(boss, { delta: 5, note: 'Nhap them mot thung tu nha cung cap' }, 'PATCH'));
  ok('Sua ton kho tay kem ly do thi duoc', withReason.status === 200, String(withReason.status));

  const moves = await call('/admin/goods/G-BAT-AN/stock/BAT-600', withToken(boss));
  ok('Lich su ton kho ghi lai lan vua sua',
    (moves.body ?? []).some((each) => each.note.includes('nha cung cap')),
    String(moves.body?.length));
  ok('Lich su ton kho ghi ca so truoc va so sau',
    (moves.body ?? []).every((each) => typeof each.before === 'number' && typeof each.after === 'number'));
  ok('Lich su ton kho ghi ca lan tru do don hang',
    (await call('/admin/goods/G-THE-TEN/stock/THE-XUONG', withToken(boss))).body
      .some((each) => each.reason === 'ORDER_PAID'));

  const tooDeep = await call('/admin/goods/G-BAT-AN/stock/BAT-600',
    asJson(boss, { delta: -999999, note: 'Thu tru qua so hang dang co' }, 'PATCH'));
  ok('Khong tru duoc nhieu hon so hang dang co', tooDeep.status === 400, String(tooDeep.status));

  // --- NT-23.11 Cham soc khach hang chi duoc xem ---
  const supportRead = await call('/admin/goods', withToken(support));
  ok('Nhom Quan tri vien khong xem duoc danh muc hang', supportRead.status === 403,
    String(supportRead.status));
  const supportWrite = await call('/admin/goods/G-BAT-AN',
    asJson(support, { name: 'Ten moi khong duoc phep dat' }, 'PATCH'));
  ok('Nhom Quan tri vien khong sua duoc gia hay ten', supportWrite.status === 403,
    String(supportWrite.status));
  const supportStock = await call('/admin/goods/G-BAT-AN/stock/BAT-600',
    asJson(support, { delta: 1, note: 'Khong duoc phep lam dieu nay' }, 'PATCH'));
  ok('Nhom Quan tri vien khong sua duoc ton kho', supportStock.status === 403,
    String(supportStock.status));
  const plainWrite = await call('/admin/goods', asJson(mine, {
    code: 'G-KHONG-HOP-LE', name: 'Hang tu tao', category: '000000000000000000000000',
    variant: [{ sku: 'X', optionValues: [], price: '1000' }],
  }));
  ok('Khach thuong khong tao duoc hang', plainWrite.status === 403, String(plainWrite.status));

  // --- Kiem tra bien: ma trung, gia sai dinh dang, to hop lech thuoc tinh ---
  const dupCode = await call('/admin/goods', asJson(boss, {
    code: 'G-BAT-AN', name: 'Trung ma', category: (await call('/admin/goods/categories', withToken(boss))).body[0]._id,
    variant: [{ sku: 'X1', optionValues: [], price: '1000' }],
  }));
  ok('Ma san pham trung bi co so du lieu tu choi', dupCode.status === 409, String(dupCode.status));

  const groupId = (await call('/admin/goods/categories', withToken(boss))).body[0]._id;
  const oddPrice = await call('/admin/goods', asJson(boss, {
    code: `G-THU-${STAMP}`, name: 'Gia le', category: groupId,
    variant: [{ sku: 'X2', optionValues: [], price: '1000.5' }],
  }));
  ok('Gia co phan le bi tu choi', oddPrice.status === 400, String(oddPrice.status));

  const oddVariant = await call('/admin/goods', asJson(boss, {
    code: `G-THU2-${STAMP}`, name: 'Lech thuoc tinh', category: groupId,
    optionNames: ['Kich co', 'Mau'],
    variant: [{ sku: 'X3', optionValues: ['Nho'], price: '1000' }],
  }));
  ok('To hop thieu gia tri thuoc tinh bi tu choi', oddVariant.status === 400,
    String(oddVariant.status));

  const dupSku = await call('/admin/goods', asJson(boss, {
    code: `G-THU3-${STAMP}`, name: 'Trung ma to hop', category: groupId,
    variant: [
      { sku: 'X4', optionValues: [], price: '1000' },
      { sku: 'X4', optionValues: [], price: '2000' },
    ],
  }));
  ok('Hai to hop trung ma bi tu choi', dupSku.status === 400, String(dupSku.status));

  console.log('='.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
