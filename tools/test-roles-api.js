/**
 * Kiem thu ba nhom quyen sau khi bo nhom Quan tri vien.
 *
 * Trong tam la ranh gioi giua hai nhom noi bo: nhom Quan ly lo toan bo van
 * hanh va ca quan ly tai khoan, kiem duyet, nhat ky. Nhom Cham soc khach hang
 * chi mo duoc ban truc gom don hang, khach hang, hoi thoai va nhat ky thanh
 * toan. Khach dung ngoai toan bo khu noi bo. Nhom Quan tri vien cu khong con
 * gan duoc cho ai nua.
 *
 * Bai kiem chi doi nhom quyen cua tai khoan do chinh no tao ra, khong dung vao
 * cac tai khoan mau. Rang buoc giu lai tai khoan Quan ly cuoi cung khong kiem
 * o day, vi muon cham toi no phai tat het cac tai khoan Quan ly that.
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
const PATH_ORDERS = '/admin/orders?page=1';
const PASSWORD_INTERNAL = 'Petmory@2026';
const PASSWORD_NEW = 'Password@123';
const PATCH = 'PATCH';
const ROLE_MANAGER = 'MANAGER';
const ROLE_SUPPORT = 'SUPPORT';
const ROLE_CUSTOMER = 'CUSTOMER';
const ROLE_GONE = 'ADMIN';
const STAMP = Date.now();
const MANAGER = { email: 'quanly@petmory.local', password: PASSWORD_INTERNAL };
const SUPPORT = { email: 'cskh@petmory.local', password: PASSWORD_INTERNAL };
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

/** Ban truc: ca nhom Quan ly lan nhom Cham soc khach hang deu mo duoc. */
const DESK_PATHS = [
  ['Bang dieu phoi don', PATH_ORDERS],
  ['Danh sach khach hang', '/admin/customers?page=1'],
  ['Nhat ky thanh toan', '/payments/log?page=1'],
  ['Hang cho hoi thoai', '/admin/chats'],
];

/** Phan chi nhom Quan ly duoc vao. */
const MANAGER_PATHS = [
  ['Kho hang co san', '/admin/goods?page=1'],
  ['Kho tri thuc cua tro ly', '/admin/assistant/knowledge'],
  ['Bao cao doanh thu', '/admin/reports/revenue'],
  ['Tham so nghiep vu', '/settings'],
  ['Kiem duyet cong dong', '/admin/diaries'],
  ['Nhat ky thao tac', '/admin/audit'],
  ['Danh sach tai khoan', PATH_ACCOUNTS],
];

const sameRoles = (body, want) => JSON.stringify(body?.roles) === JSON.stringify(want);

async function checkWhoIsWho(manager, support, customer) {
  ok('Tai khoan nhom Quan ly dang nhap duoc', Boolean(manager));
  ok('Tai khoan nhom Cham soc khach hang dang nhap duoc', Boolean(support));
  ok('Tai khoan khach dang nhap duoc', Boolean(customer));

  const whoManager = await call(PATH_ME, withToken(manager));
  ok('Nhom Quan ly mang dung mot nhom quyen', sameRoles(whoManager.body, [ROLE_MANAGER]),
    JSON.stringify(whoManager.body?.roles));
  const whoSupport = await call(PATH_ME, withToken(support));
  ok('Nhom Cham soc khach hang mang dung mot nhom quyen', sameRoles(whoSupport.body, [ROLE_SUPPORT]),
    JSON.stringify(whoSupport.body?.roles));
}

async function checkPaths(manager, support, customer) {
  console.log('');
  console.log('Ban truc');
  for (const [name, where] of DESK_PATHS) {
    const byManager = await call(where, withToken(manager));
    ok(`Nhom Quan ly mo duoc ${name}`, byManager.status === 200, String(byManager.status));
    const bySupport = await call(where, withToken(support));
    ok(`Nhom CSKH mo duoc ${name}`, bySupport.status === 200, String(bySupport.status));
    const byCustomer = await call(where, withToken(customer));
    ok(`Khach KHONG mo duoc ${name}`, byCustomer.status === 403, String(byCustomer.status));
  }

  console.log('');
  console.log('Phan chi danh cho nhom Quan ly');
  for (const [name, where] of MANAGER_PATHS) {
    const byManager = await call(where, withToken(manager));
    ok(`Nhom Quan ly mo duoc ${name}`, byManager.status === 200, String(byManager.status));
    const bySupport = await call(where, withToken(support));
    ok(`Nhom CSKH KHONG mo duoc ${name}`, bySupport.status === 403, String(bySupport.status));
    const byCustomer = await call(where, withToken(customer));
    ok(`Khach KHONG mo duoc ${name}`, byCustomer.status === 403, String(byCustomer.status));
  }

  const summary = await call('/admin/accounts/summary', withToken(manager));
  const keys = Object.keys(summary.body ?? {}).sort((a, b) => a.localeCompare(b));
  ok('Dem so tai khoan theo dung ba nhom',
    JSON.stringify(keys) === JSON.stringify([ROLE_CUSTOMER, ROLE_MANAGER, ROLE_SUPPORT])
      && keys.every((key) => typeof summary.body[key] === 'number'),
    JSON.stringify(summary.body));
}

/** Tao mot tai khoan rieng cho bai kiem, roi chuyen no qua tung nhom. */
async function checkRoleChanges(manager, support) {
  console.log('');
  console.log('Tao tai khoan va doi nhom quyen');
  const email = `vaitro.${STAMP}@petmory.local`;
  const made = await call(
    '/admin/accounts',
    asJson(manager, { email, password: PASSWORD_NEW, fullName: 'Nguoi thu vai tro', role: ROLE_CUSTOMER }),
  );
  ok('Nhom Quan ly tao duoc tai khoan moi', made.status === 201, String(made.status));
  const newId = made.body?._id;
  ok('Tai khoan moi mang dung nhom da chon', sameRoles(made.body, [ROLE_CUSTOMER]),
    JSON.stringify(made.body?.roles));
  const firstToken = await signIn({ email, password: PASSWORD_NEW });
  ok('Tai khoan vua tao dang nhap duoc', Boolean(firstToken));

  const byDesk = await call('/admin/accounts', asJson(support, {
    email: `cskh.tao.${STAMP}@petmory.local`, password: PASSWORD_NEW, fullName: 'Khong duoc tao', role: ROLE_CUSTOMER,
  }));
  ok('Nhom CSKH KHONG tao duoc tai khoan', byDesk.status === 403, String(byDesk.status));
  const deskChange = await call(`/admin/accounts/${newId}/role`, asJson(support, { role: ROLE_MANAGER }, PATCH));
  ok('Nhom CSKH KHONG doi duoc nhom quyen', deskChange.status === 403, String(deskChange.status));

  const goneOnCreate = await call('/admin/accounts', asJson(manager, {
    email: `cu.${STAMP}@petmory.local`, password: PASSWORD_NEW, fullName: 'Nhom cu', role: ROLE_GONE,
  }));
  ok('Tao tai khoan voi nhom Quan tri vien cu bi tu choi', goneOnCreate.status === 400, String(goneOnCreate.status));
  const goneOnChange = await call(`/admin/accounts/${newId}/role`, asJson(manager, { role: ROLE_GONE }, PATCH));
  ok('Doi sang nhom Quan tri vien cu bi tu choi', goneOnChange.status === 400, String(goneOnChange.status));

  const toDesk = await call(`/admin/accounts/${newId}/role`, asJson(manager, { role: ROLE_SUPPORT }, PATCH));
  ok('Doi duoc sang nhom Cham soc khach hang', toDesk.status === 200, String(toDesk.status));
  const readDesk = await call(`/admin/accounts/${newId}`, withToken(manager));
  ok('Nhom quyen doc lai tu may chu da doi theo', sameRoles(readDesk.body, [ROLE_SUPPORT]),
    JSON.stringify(readDesk.body?.roles));
  const afterChange = await call(PATH_ME, withToken(firstToken));
  ok('Ma dang nhap cu bi bo sau khi doi quyen', afterChange.status === 401, String(afterChange.status));

  const deskToken = await signIn({ email, password: PASSWORD_NEW });
  const deskOrders = await call(PATH_ORDERS, withToken(deskToken));
  ok('Tai khoan vua sang nhom CSKH mo duoc bang dieu phoi', deskOrders.status === 200, String(deskOrders.status));
  const deskAccounts = await call(PATH_ACCOUNTS, withToken(deskToken));
  ok('Tai khoan vua sang nhom CSKH KHONG mo duoc danh sach tai khoan',
    deskAccounts.status === 403, String(deskAccounts.status));

  const toManager = await call(`/admin/accounts/${newId}/role`, asJson(manager, { role: ROLE_MANAGER }, PATCH));
  ok('Doi duoc sang nhom Quan ly', toManager.status === 200, String(toManager.status));
  const managerToken = await signIn({ email, password: PASSWORD_NEW });
  const nowAccounts = await call(PATH_ACCOUNTS, withToken(managerToken));
  ok('Tai khoan vua len nhom Quan ly mo duoc danh sach tai khoan',
    nowAccounts.status === 200, String(nowAccounts.status));

  return { newId, email, managerToken };
}

/*
 * Hai rang buoc tu bao ve duoc kiem bang chinh tai khoan bai kiem vua dua len
 * nhom Quan ly, de neu rang buoc hong thi chi tai khoan do bi anh huong.
 */
async function checkSelfGuards(newId, managerToken) {
  console.log('');
  console.log('Hai rang buoc bao ve');
  const selfRole = await call(`/admin/accounts/${newId}/role`, asJson(managerToken, { role: ROLE_CUSTOMER }, PATCH));
  ok('Khong tu doi duoc nhom quyen cua chinh minh', selfRole.status === 400, String(selfRole.status));
  const selfOff = await call(`/admin/accounts/${newId}/active`, asJson(managerToken, { active: false }, PATCH));
  ok('Khong tu tat duoc tai khoan cua chinh minh', selfOff.status === 400, String(selfOff.status));
  const stillManager = await call(`/admin/accounts/${newId}`, withToken(managerToken));
  ok('Sau hai lan bi tu choi tai khoan van o nhom Quan ly va dang bat',
    sameRoles(stillManager.body, [ROLE_MANAGER]) && stillManager.body?.active === true,
    JSON.stringify({ roles: stillManager.body?.roles, active: stillManager.body?.active }));
}

async function checkActiveAndPassword(manager, newId, email) {
  console.log('');
  console.log('Bat tat va dat lai mat khau');
  const turnedOff = await call(`/admin/accounts/${newId}/active`, asJson(manager, { active: false }, PATCH));
  ok('Tat duoc mot tai khoan', turnedOff.status === 200, String(turnedOff.status));
  const blocked = await call(PATH_LOGIN, asJson(null, { email, password: PASSWORD_NEW }));
  ok('Tai khoan da tat thi khong dang nhap duoc',
    blocked.status === 401 || blocked.status === 403, String(blocked.status));

  await call(`/admin/accounts/${newId}/active`, asJson(manager, { active: true }, PATCH));
  const backOn = await signIn({ email, password: PASSWORD_NEW });
  ok('Bat lai thi dang nhap duoc tro lai', Boolean(backOn));

  const reset = await call(`/admin/accounts/${newId}/password`, asJson(manager, { password: 'MoiHon@456' }, PATCH));
  ok('Dat lai duoc mat khau', reset.status === 200, String(reset.status));
  const withNew = await signIn({ email, password: 'MoiHon@456' });
  ok('Mat khau moi dung duoc', Boolean(withNew));
  const withOld = await call(PATH_LOGIN, asJson(null, { email, password: PASSWORD_NEW }));
  ok('Mat khau cu khong dung duoc nua', withOld.status === 401, String(withOld.status));

  /* Tra tai khoan bai kiem ve nhom khach de so tai khoan Quan ly khong tang dan. */
  const back = await call(`/admin/accounts/${newId}/role`, asJson(manager, { role: ROLE_CUSTOMER }, PATCH));
  ok('Tra tai khoan bai kiem ve nhom khach', back.status === 200, String(back.status));
}

async function run() {
  console.log('BA NHOM QUYEN: QUAN LY, CHAM SOC KHACH HANG, KHACH');
  console.log('='.repeat(66));

  const manager = await signIn(MANAGER);
  const support = await signIn(SUPPORT);
  const customer = await signIn(CUSTOMER);

  await checkWhoIsWho(manager, support, customer);
  await checkPaths(manager, support, customer);
  const { newId, email, managerToken } = await checkRoleChanges(manager, support);
  await checkSelfGuards(newId, managerToken);
  await checkActiveAndPassword(manager, newId, email);

  console.log('');
  console.log('-'.repeat(66));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed} MUC HONG, ${passed} MUC PASS`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
