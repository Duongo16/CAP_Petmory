/**
 * Kiem thu tro ly hoi thoai (Phu luc 01, muc 9 va 18).
 *
 * Gom: bat buoc dang nhap, kho tri thuc va phan quyen sua kho, tra loi tu kho
 * kem duong dan dan huong, nho ngu canh qua hai luot hoi, chuyen sang nhom
 * Cham soc khach hang va nhan vien tra loi, va (neu co khoa) mot luot goi mo
 * hinh ngon ngu that.
 *
 * Chi dung cac tai khoan demo co san, khong tao tai khoan moi. Muc kho tri
 * thuc tao ra de thu duoc an lai khi xong.
 *
 * Chay: node tools/test-assistant-api.js
 */
const fs = require('fs');
const path = require('path');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const PASSWORD = 'Petmory@2026';
const CUSTOMER = { email: 'khachhang@petmory.local', password: PASSWORD };
const SUPPORT = { email: 'cskh@petmory.local', password: PASSWORD };
const BOSS = { email: 'quanly@petmory.local', password: PASSWORD };
const TEST_CODE = `TEST-${STAMP}`;
const TEST_WORD = `matkhauthu${STAMP}`;

let failed = 0;
let passed = 0;
let skipped = 0;
function ok(name, good, note = '') {
  if (good) {
    passed += 1;
  } else {
    failed += 1;
  }
  console.log(`  ${good ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}
function skip(name, why) {
  skipped += 1;
  console.log(`  SKIP  ${name}  (${why})`);
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

const send = (token, data, method = 'POST') => ({
  method,
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(data),
});
const read = (token) => ({ headers: { authorization: `Bearer ${token}` } });

async function signIn(who) {
  const res = await call('/auth/login', send(null, who));
  if (!res.body?.accessToken) {
    throw new Error(`Khong dang nhap duoc ${who.email}: ${res.status}`);
  }
  return res.body.accessToken;
}

/** Hoi mot cau trong phien va tra ve luot tra loi cuoi cung. */
async function ask(token, code, question) {
  const res = await call(`/assistant/sessions/${code}/ask`, send(token, { question }));
  const turns = res.body?.turn ?? [];
  return { status: res.status, last: turns[turns.length - 1] ?? null };
}

/** Co khoa mo hinh ngon ngu trong .env hay khong. Chi doc co hay khong, khong doc gia tri. */
function hasLlmKey() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
    return /^(GEMINI_API_KEY|ANTHROPIC_API_KEY)=\S+/m.test(env);
  } catch {
    return false;
  }
}

async function run() {
  console.log('TRO LY HOI THOAI');
  console.log('='.repeat(64));

  // --- Bat buoc dang nhap ---
  ok('Khach chua dang nhap khong mo duoc phien', (await call('/assistant/sessions', send(null, {}))).status === 401);
  ok('Khach chua dang nhap khong hoi duoc tro ly co ban', (await call('/assistant/ask', send(null, { question: 'gia' }))).status === 401);

  const customer = await signIn(CUSTOMER);
  const support = await signIn(SUPPORT);
  const boss = await signIn(BOSS);

  // --- Kho tri thuc va phan quyen ---
  ok('Khach hang khong doc duoc kho tri thuc', (await call('/admin/assistant/knowledge', read(customer))).status === 403);
  ok('Nhom Cham soc khach hang khong sua duoc kho tri thuc',
    (await call('/admin/assistant/knowledge', send(support, { code: TEST_CODE }))).status === 403);
  const list = await call('/admin/assistant/knowledge', read(boss));
  ok('Nhom Quan ly doc duoc kho tri thuc', list.status === 200 && list.body.length >= 10, `${list.body?.length} muc`);

  const made = await call('/admin/assistant/knowledge', send(boss, {
    code: TEST_CODE,
    question: 'Câu hỏi kiểm thử của trợ lý',
    keywords: [TEST_WORD],
    answer: 'Đây là câu trả lời kiểm thử. Thời gian: {{THOI_GIAN}}.',
    link: '/shop?tab=ready',
    topic: 'OTHER',
    sortOrder: 9999,
  }));
  ok('Them duoc muc moi vao kho', made.status === 201, String(made.status));
  ok('Ma muc trung bi tu choi',
    (await call('/admin/assistant/knowledge', send(boss, { code: TEST_CODE, question: 'abc', keywords: ['x'], answer: 'abc' }))).status === 409);
  ok('Duong dan ra ngoai trang bi tu choi',
    (await call(`/admin/assistant/knowledge/${TEST_CODE}`, send(boss, { link: 'https://example.com' }, 'PATCH'))).status === 400);

  // --- Tro ly tra loi tu kho ---
  const opened = await call('/assistant/sessions', send(customer, {}));
  ok('Nguoi da dang nhap mo duoc phien', opened.status === 201, String(opened.status));
  const code = opened.body.code;
  ok('Loi chao co cau goi y lay tu kho', (opened.body.turn[0].suggestion ?? []).length >= 3,
    (opened.body.turn[0].suggestion ?? []).slice(0, 3).join(' | '));

  // Tro ly co ban luon doc thang kho tri thuc, nen kiem noi dung nguyen van o day.
  const basic = await call('/assistant/ask', send(customer, { question: `cho mình hỏi ${TEST_WORD} nhé` }));
  const basicText = basic.body?.content ?? '';
  ok('Tra loi dung muc vua them vao kho', basicText.includes('câu trả lời kiểm thử'), basicText.slice(0, 80));
  ok('O thoi gian duoc dien bang so lieu that', /\d+ (đến \d+ )?ngày/.test(basicText) && !basicText.includes('{{'));
  // Trong phien (co hay khong co mo hinh that), nut dan huong van lay tu muc kho khop nhat.
  const fromKb = await ask(customer, code, `cho mình hỏi ${TEST_WORD} nhé`);
  ok('Cau tra loi trong phien kem duong dan dan huong', fromKb.last?.path === '/shop?tab=ready', fromKb.last?.path);

  await call(`/admin/assistant/knowledge/${TEST_CODE}`, send(boss, { enabled: false }, 'PATCH'));
  await new Promise((done) => setTimeout(done, 400));

  // --- Nho ngu canh qua hai luot ---
  const live = hasLlmKey();
  const first = await ask(customer, code, 'Tượng len chọc giá bao nhiêu?');
  const second = await ask(customer, code, 'còn cỡ lớn thì sao?');
  const said = second.last?.text ?? '';
  if (live) {
    ok('Hoi tiep van hieu dang noi ve tuong len (mo hinh that)', /tượng/i.test(said) && /lớn/i.test(said), said.slice(0, 100));
  } else {
    ok('Luot dau tra loi gia cua tuong len', (first.last?.text ?? '').includes('Tượng len'), (first.last?.text ?? '').slice(0, 80));
    ok('Hoi tiep "co lon" chi noi ve tuong len', said.includes('Tượng len') && said.includes('Lớn') && !said.includes('Móc khóa'),
      said.replace(/\n/g, ' / ').slice(0, 120));
  }

  // --- Mo hinh ngon ngu that ---
  if (live) {
    const llm = await ask(customer, code, 'Mình muốn làm quà tặng cho bé mèo nhà mình thì nên chọn sản phẩm nào, giá khoảng bao nhiêu?');
    const text = llm.last?.text ?? '';
    ok('Mo hinh that tra loi tieng Viet co dau', /[ạảãàáâầấậẩẫăằắặẳẵêềếệểễôồốộổỗơờớợởỡưừứựửữđ]/i.test(text), text.slice(0, 100));
    ok('Mo hinh that nhac dung gia co trong danh muc', /\d{2,3}\.\d{3}/.test(text), text.slice(0, 160));
  } else {
    skip('Goi mo hinh ngon ngu that', 'chua co GEMINI_API_KEY trong .env');
  }

  // --- Chuyen sang nhom Cham soc khach hang ---
  const handed = await call(`/assistant/sessions/${code}/handover`, send(customer, { note: 'Mình cần hỏi về đơn hàng' }));
  ok('Khach xin gap tu van vien', handed.status === 200 && handed.body.state === 'WAITING', handed.body?.state);
  const queue = await call('/admin/chats', read(support));
  ok('Nhom Cham soc khach hang thay phien dang cho', (queue.body ?? []).some((one) => one.code === code));
  ok('Nhom Cham soc khach hang nhan phien', (await call(`/admin/chats/${code}/take`, send(support, {}))).status < 300);
  const reply = await call(`/admin/chats/${code}/reply`, send(support, { text: 'Chào bạn, mình là tư vấn viên PETMORY đây.' }));
  ok('Nhan vien tra loi duoc', reply.status < 300, String(reply.status));
  const seen = await call(`/assistant/sessions/${code}`, read(customer));
  ok('Khach thay cau tra loi cua nhan vien', (seen.body?.turn ?? []).some((one) => one.side === 'STAFF'));
  const waitWords = await ask(customer, code, 'Cảm ơn bạn');
  ok('Khi nhan vien dang tra loi, may khong chen vao', !(waitWords.last?.text ?? '').includes('Giá theo'));
  ok('Khach khac khong doc duoc phien nay',
    (await call(`/assistant/sessions/${code}`, read(boss))).status === 404);
  await call(`/admin/chats/${code}/close`, send(support, {}));

  // --- Don dep ---
  const hidden = await call(`/admin/assistant/knowledge/${TEST_CODE}`, { method: 'DELETE', ...read(boss) });
  ok('An duoc muc thu nghiem', hidden.status === 200, String(hidden.status));

  console.log('='.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS${skipped ? `, ${skipped} muc bo qua` : ''}` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
