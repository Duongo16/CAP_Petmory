/**
 * Kiem thu ba nhom quyen sau khi rut gon.
 *
 * Trong tam la ranh gioi giua hai nhom noi bo: nhom Quan ly lo van hanh nhung
 * khong tao duoc tai khoan, nhom Quan tri vien tao duoc tai khoan nhung khong
 * mo duoc don hang, tien hay bao cao.
 *
 * Moi ket qua deu doc lai tu may chu sau khi thao tac, khong tin vao cau tra
 * loi cua chinh lenh vua goi.
 *
 * Chay: node tools/test-roles-api.js
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';

/** Cac duong va chuoi dung lai nhieu lan, gom lai mot cho. */
const PATH_LOGIN = '/auth/login';
const PATH_ME = '/auth/me';
const PATH_ACCOUNTS = '/admin/accounts?page=1';
const PASSWORD_INTERNAL = 'Petmory@2026';
const PASSWORD_NEW = 'Password@123';
const PATCH = 'PATCH';
const ROLE_MANAGER = 'MANAGER';
const ROLE_CUSTOMER = 'CUSTOMER';
const STAMP = Date.now();
const MANAGER = { email: 'quanly@petmory.local', password: PASSWORD_INTERNAL };
const ADMIN = { email: 'quantri@petmory.local', password: PASSWORD_INTERNAL };
const CUSTOMER = { email: 'khachhang@petmory.local', password: PASSWORD_INTERNAL };

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
  const answer = await call(PATH_LOGIN, asJson(null, who));
  return answer.body?.accessToken ?? null;
}

/** Cac duong thuoc phan van hanh, chi nhom Quan ly duoc vao. */
const RUNNING_PATHS = [
  ['Bang dieu phoi don', '/admin/orders?page=1'],
  ['Danh sach khach hang', '/admin/customers?page=1'],
  ['Nhat ky thanh toan', '/payments/log?page=1'],
  ['Kho hang co san', '/admin/goods?page=1'],
  ['Bao cao doanh thu', '/admin/reports/revenue'],
  ['Tham so nghiep vu', '/settings'],
  ['Hang cho hoi thoai', '/admin/chats'],
];

async function run() {
  console.log('BA NHOM QUYEN SAU KHI RUT GON');
  console.log('='.repeat(66));

  const manager = await signIn(MANAGER);
  const admin = await signIn(ADMIN);
  const customer = await signIn(CUSTOMER);

  ok('Tai khoan nhom Quan ly dang nhap duoc', Boolean(manager));
  ok('Tai khoan nhom Quan tri vien dang nhap duoc', Boolean(admin));
  ok('Tai khoan khach dang nhap duoc', Boolean(customer));

  const whoAdmin = await call(PATH_ME, withToken(admin));
  ok('Nhom Quan tri vien mang dung mot nhom quyen',
    JSON.stringify(whoAdmin.body?.roles) === JSON.stringify(['ADMIN']),
    JSON.stringify(whoAdmin.body?.roles));
  const whoManager = await call(PATH_ME, withToken(manager));
  ok('Nhom Quan ly mang dung mot nhom quyen',
    JSON.stringify(whoManager.body?.roles) === JSON.stringify([ROLE_MANAGER]),
    JSON.stringify(whoManager.body?.roles));

  // --- Phan van hanh: chi nhom Quan ly ---
  console.log('');
  console.log('Phan van hanh');
  for (const [name, where] of RUNNING_PATHS) {
    const byManager = await call(where, withToken(manager));
    ok(`Nhom Quan ly mo duoc ${name}`, byManager.status === 200, String(byManager.status));
    const byAdmin = await call(where, withToken(admin));
    ok(`Nhom Quan tri vien KHONG mo duoc ${name}`, byAdmin.status === 403, String(byAdmin.status));
  }

  // --- Quan ly tai khoan: chi nhom Quan tri vien ---
  console.log('');
  console.log('Quan ly tai khoan');
  const listByAdmin = await call(PATH_ACCOUNTS, withToken(admin));
  ok('Nhom Quan tri vien doc duoc danh sach tai khoan',
    listByAdmin.status === 200, String(listByAdmin.status));
  const listByManager = await call(PATH_ACCOUNTS, withToken(manager));
  ok('Nhom Quan ly KHONG doc duoc danh sach tai khoan',
    listByManager.status === 403, String(listByManager.status));
  const listByCustomer = await call(PATH_ACCOUNTS, withToken(customer));
  ok('Khach KHONG doc duoc danh sach tai khoan',
    listByCustomer.status === 403, String(listByCustomer.status));

  const summary = await call('/admin/accounts/summary', withToken(admin));
  ok('Dem duoc so tai khoan tung nhom',
    typeof summary.body?.CUSTOMER === 'number', JSON.stringify(summary.body));

  // --- Tao tai khoan ---
  const email = `vaitro.${STAMP}@petmory.local`;
  const made = await call(
    '/admin/accounts',
    asJson(admin, { email, password: PASSWORD_NEW, fullName: 'Nguoi thu vai tro', role: ROLE_CUSTOMER }),
  );
  ok('Tao duoc tai khoan moi', made.status === 201, String(made.status));
  const newId = made.body?._id;
  ok('Tai khoan moi mang dung nhom da chon',
    JSON.stringify(made.body?.roles) === JSON.stringify([ROLE_CUSTOMER]),
    JSON.stringify(made.body?.roles));

  const canSignIn = await signIn({ email, password: PASSWORD_NEW });
  ok('Tai khoan vua tao dang nhap duoc', Boolean(canSignIn));

  const badRole = await call(
    '/admin/accounts',
    asJson(admin, { email: `la.${STAMP}@petmory.local`, password: PASSWORD_NEW, fullName: 'Nhom la', role: 'SUPPORT' }),
  );
  ok('Nhom quyen khong con ton tai thi bi tu choi', badRole.status === 400, String(badRole.status));

  // --- Doi nhom quyen ---
  const promoted = await call(`/admin/accounts/${newId}/role`, asJson(admin, { role: ROLE_MANAGER }, PATCH));
  ok('Doi duoc nhom quyen', promoted.status === 200, String(promoted.status));
  const readBack = await call(`/admin/accounts/${newId}`, withToken(admin));
  ok('Nhom quyen doc lai tu may chu da doi theo',
    JSON.stringify(readBack.body?.roles) === JSON.stringify([ROLE_MANAGER]),
    JSON.stringify(readBack.body?.roles));

  const oldToken = canSignIn;
  const afterChange = await call(PATH_ME, withToken(oldToken));
  ok('Ma dang nhap cu bi bo sau khi doi quyen',
    afterChange.status === 401, String(afterChange.status));

  const nowManager = await signIn({ email, password: PASSWORD_NEW });
  const nowCanSeeOrders = await call('/admin/orders?page=1', withToken(nowManager));
  ok('Tai khoan vua len nhom Quan ly mo duoc bang dieu phoi',
    nowCanSeeOrders.status === 200, String(nowCanSeeOrders.status));

  // --- Hai rang buoc bao ve ---
  console.log('');
  console.log('Hai rang buoc bao ve');
  const me = await call(PATH_ME, withToken(admin));
  const selfRole = await call(
    `/admin/accounts/${me.body.userId}/role`,
    asJson(admin, { role: ROLE_CUSTOMER }, PATCH),
  );
  ok('Khong tu doi duoc nhom quyen cua chinh minh',
    selfRole.status === 400, String(selfRole.status));

  const selfOff = await call(
    `/admin/accounts/${me.body.userId}/active`,
    asJson(admin, { active: false }, PATCH),
  );
  ok('Khong tu tat duoc tai khoan cua chinh minh',
    selfOff.status === 400, String(selfOff.status));

  // --- Bat tat tai khoan ---
  const turnedOff = await call(`/admin/accounts/${newId}/active`, asJson(admin, { active: false }, PATCH));
  ok('Tat duoc mot tai khoan', turnedOff.status === 200, String(turnedOff.status));
  const blocked = await call(PATH_LOGIN, asJson(null, { email, password: PASSWORD_NEW }));
  ok('Tai khoan da tat thi khong dang nhap duoc',
    blocked.status === 401 || blocked.status === 403, String(blocked.status));

  await call(`/admin/accounts/${newId}/active`, asJson(admin, { active: true }, PATCH));
  const backOn = await signIn({ email, password: PASSWORD_NEW });
  ok('Bat lai thi dang nhap duoc tro lai', Boolean(backOn));

  // --- Dat lai mat khau ---
  const reset = await call(`/admin/accounts/${newId}/password`, asJson(admin, { password: 'MoiHon@456' }, PATCH));
  ok('Dat lai duoc mat khau', reset.status === 200, String(reset.status));
  const withNew = await signIn({ email, password: 'MoiHon@456' });
  ok('Mat khau moi dung duoc', Boolean(withNew));
  const withOld = await call(PATH_LOGIN, asJson(null, { email, password: PASSWORD_NEW }));
  ok('Mat khau cu khong dung duoc nua', withOld.status === 401, String(withOld.status));

  console.log('');
  console.log('-'.repeat(66));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed} MUC HONG, ${passed} MUC PASS`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
