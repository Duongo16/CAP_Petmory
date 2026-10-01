/**
 * Nap du lieu mau cho dong hang co san.
 *
 * Di qua chinh duong quan tri chu khong ghi thang vao co so du lieu, nen moi
 * quy tac cua may chu deu duoc ap dung y nhu khi Ben A tu nhap hang. Chay lai
 * nhieu lan khong sinh ra ban trung: ma da co thi bo qua.
 *
 * Chay: node tools/seed-goods.js
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const BOSS_EMAIL = 'quanly@petmory.local';
const BOSS_PASSWORD = 'Petmory@2026';

/** Duong dan anh minh hoa, do lenh ve anh hang co san sinh ra. */
const PICTURE = (name) => `/demo/goods/${name}.png`;

const CATEGORIES = [
  { code: 'DO-DUNG', name: 'Đồ dùng hằng ngày', sortOrder: 1,
    description: 'Bát ăn, vòng cổ, dây dắt và những thứ bé dùng mỗi ngày.' },
  { code: 'PHU-KIEN', name: 'Phụ kiện', sortOrder: 2,
    description: 'Thẻ tên khắc, nơ, khăn quàng cho bé.' },
  { code: 'LUU-NIEM', name: 'Đồ lưu niệm', sortOrder: 3,
    description: 'Những món giữ lại kỷ niệm về bé.' },
  { code: 'HOP-KHUNG', name: 'Hộp và khung trưng bày', sortOrder: 4,
    description: 'Hộp quà và khung để bày kỷ vật.' },
];

const GOODS = [
  {
    code: 'G-VONG-LEN',
    name: 'Vòng cổ len chọc thủ công',
    category: 'DO-DUNG',
    description: 'Vòng cổ bện từ len cừu tự nhiên, khoá nhựa nhẹ, kèm thẻ tên nhỏ.',
    images: [PICTURE('collar')],
    optionNames: ['Kích cỡ', 'Màu'],
    deliveryDays: 2,
    variant: [
      { sku: 'VONG-S-NAU', optionValues: ['Nhỏ', 'Nâu'], price: '180000', stock: 12 },
      { sku: 'VONG-S-TIM', optionValues: ['Nhỏ', 'Tím'], price: '180000', stock: 8 },
      { sku: 'VONG-M-NAU', optionValues: ['Vừa', 'Nâu'], price: '210000', stock: 5 },
      { sku: 'VONG-M-TIM', optionValues: ['Vừa', 'Tím'], price: '210000', stock: 0 },
    ],
  },
  {
    code: 'G-BAT-AN',
    name: 'Bát ăn gốm men tím',
    category: 'DO-DUNG',
    description: 'Bát gốm nung ở nhiệt độ cao, đế chống trượt, rửa máy được.',
    images: [PICTURE('bowl')],
    optionNames: ['Dung tích'],
    deliveryDays: 2,
    variant: [
      { sku: 'BAT-300', optionValues: ['300 ml'], price: '150000', stock: 20 },
      { sku: 'BAT-600', optionValues: ['600 ml'], price: '195000', stock: 14 },
    ],
  },
  {
    code: 'G-THE-TEN',
    name: 'Thẻ tên khắc laser',
    category: 'PHU-KIEN',
    description: 'Thẻ đồng thau khắc tên bé và số điện thoại của bạn, kèm khoen treo.',
    images: [PICTURE('tag')],
    optionNames: ['Hình dáng'],
    deliveryDays: 3,
    variant: [
      { sku: 'THE-TRON', optionValues: ['Tròn'], price: '95000', stock: 30 },
      { sku: 'THE-XUONG', optionValues: ['Hình xương'], price: '105000', stock: 18 },
    ],
  },
  {
    code: 'G-KHUNG-GO',
    name: 'Khung ảnh gỗ sồi',
    category: 'HOP-KHUNG',
    description: 'Khung gỗ sồi tự nhiên, mặt kính, dựng bàn hoặc treo tường đều được.',
    images: [PICTURE('frame')],
    optionNames: ['Kích thước'],
    deliveryDays: 3,
    variant: [
      { sku: 'KHUNG-13X18', optionValues: ['13 × 18 cm'], price: '250000', stock: 9 },
      { sku: 'KHUNG-20X25', optionValues: ['20 × 25 cm'], price: '340000', stock: 6 },
    ],
  },
  {
    code: 'G-HOP-QUA',
    name: 'Hộp quà giấy tái chế',
    category: 'HOP-KHUNG',
    description: 'Hộp giấy tái chế thắt nơ vải, vừa cho một kỷ vật cỡ nhỏ hoặc vừa.',
    images: [PICTURE('giftbox')],
    optionNames: ['Cỡ hộp'],
    deliveryDays: 2,
    variant: [
      { sku: 'HOP-NHO', optionValues: ['Nhỏ'], price: '60000', stock: 40 },
      { sku: 'HOP-VUA', optionValues: ['Vừa'], price: '85000', stock: 25 },
    ],
  },
  {
    code: 'G-CHAN-NI',
    name: 'Chăn nỉ cho bé',
    category: 'LUU-NIEM',
    description: 'Chăn nỉ mềm, viền may kép, giặt máy không xù.',
    images: [PICTURE('blanket')],
    optionNames: ['Kích thước', 'Màu'],
    deliveryDays: 4,
    variant: [
      { sku: 'CHAN-S-BO', optionValues: ['Nhỏ', 'Bơ'], price: '220000', stock: 11 },
      { sku: 'CHAN-S-XANH', optionValues: ['Nhỏ', 'Xanh rêu'], price: '220000', stock: 7 },
      { sku: 'CHAN-L-BO', optionValues: ['Lớn', 'Bơ'], price: '320000', stock: 4 },
    ],
  },
];

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
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(data),
});

async function run() {
  console.log('NAP DU LIEU HANG CO SAN');
  console.log('='.repeat(62));

  const signedIn = await call('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: BOSS_EMAIL, password: BOSS_PASSWORD }),
  });
  if (!signedIn.body?.accessToken) {
    console.log(`  Khong dang nhap duoc bang ${BOSS_EMAIL}. May chu tra ve ${signedIn.status}.`);
    process.exit(1);
  }
  const token = signedIn.body.accessToken;

  const idOfCode = new Map();
  for (const one of CATEGORIES) {
    const made = await call('/admin/goods/categories', asJson(token, one));
    if (made.status === 201) {
      idOfCode.set(one.code, made.body._id);
      console.log(`  nhom  ${one.code.padEnd(10)} da tao`);
    } else if (made.status === 409) {
      console.log(`  nhom  ${one.code.padEnd(10)} da co san`);
    } else {
      console.log(`  nhom  ${one.code.padEnd(10)} HONG ${made.status} ${made.text.slice(0, 120)}`);
    }
  }

  const groups = await call('/admin/goods/categories', { headers: { authorization: `Bearer ${token}` } });
  for (const one of groups.body ?? []) {
    idOfCode.set(one.code, one._id);
  }

  let made = 0;
  for (const one of GOODS) {
    const category = idOfCode.get(one.category);
    if (!category) {
      console.log(`  hang  ${one.code.padEnd(12)} HONG: khong thay nhom ${one.category}`);
      continue;
    }
    const answer = await call('/admin/goods', asJson(token, { ...one, category }));
    if (answer.status === 201) {
      made += 1;
      console.log(`  hang  ${one.code.padEnd(12)} da tao, ${one.variant.length} to hop`);
    } else if (answer.status === 409) {
      console.log(`  hang  ${one.code.padEnd(12)} da co san`);
    } else {
      console.log(`  hang  ${one.code.padEnd(12)} HONG ${answer.status} ${answer.text.slice(0, 160)}`);
    }
  }

  const shown = await call('/goods');
  console.log('-'.repeat(62));
  console.log(`Trang khach dang thay ${shown.body?.total ?? 0} mon hang co san.`);
  process.exit(0);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
