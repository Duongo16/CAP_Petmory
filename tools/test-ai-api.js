/**
 * Kiem thu ba chuc nang tri tue nhan tao, theo Phu luc 01 muc 15, 16 va 18.
 *
 * Trong tam la nhung cho de sai chu khong phai chat luong cau van: han muc co
 * chan that khong khi hai yeu cau gui cung luc, phuong an tra ve co bi rang
 * buoc trong thu vien that khong, chuyen trang thai hoi thoai co di dung buoc
 * khong, va nguoi la co doc duoc phien cua nguoi khac khong.
 *
 * Moi con so deu duoc doc lai tu may chu sau khi thao tac, khong tin vao cau
 * tra loi cua chinh lenh vua goi.
 *
 * Chay: node tools/test-ai-api.js
 */
const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const PASSWORD = 'Password@123';
const BOSS = { email: 'quanly@petmory.local', password: 'Petmory@2026' };
const SUPPORT = { email: 'cskh@petmory.local', password: 'Petmory@2026' };

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

/** Bo dau tieng Viet va chu hoa de so sanh noi dung. */
function withoutMarks(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
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
  const email = `ai.${tag}.${STAMP}@petmory.local`;
  const made = await call(
    '/auth/register',
    asJson(null, { email, password: PASSWORD, fullName: `Khach ${tag}` }),
  );
  return made.body.accessToken;
}

async function makePet(token, name) {
  const made = await call(
    '/pets',
    asJson(token, { name, kind: 'DOG', breed: 'Shiba', gender: 'MALE' }),
  );
  return made.body?._id ?? null;
}

/** Dat lai han muc cua mot chuc nang, de bai kiem chay tren con so biet truoc. */
async function setQuota(boss, kind, day) {
  const now = await call('/settings', withToken(boss));
  const quota = { ...(now.body?.aiQuota ?? {}) };
  quota[kind] = { day, month: 100000, year: 1000000 };
  return call('/settings', asJson(boss, { aiQuota: quota }, 'PATCH'));
}

async function run() {
  console.log('BA CHUC NANG TRI TUE NHAN TAO');
  console.log('='.repeat(64));

  const boss = await signIn(BOSS);
  /* Truc hoi thoai thuoc ban cham soc khach hang, nen tai khoan nhom CSKH lam viec do. */
  const support = await signIn(SUPPORT);
  const mine = await makeCustomer('chu');
  const other = await makeCustomer('nguoila');
  const petId = await makePet(mine, `Mun ${STAMP}`);
  ok('Tao duoc ho so be de lam nen bai kiem', Boolean(petId), String(petId));

  // ---------- Muc 15: goi y thiet ke ----------
  console.log('');
  console.log('Muc 15 — Goi y thiet ke');
  await setQuota(boss, 'designSuggestion', 50);

  const styles = await call('/design-suggestions/styles', withToken(mine));
  ok('Co danh sach phong cach chon duoc', (styles.body?.style ?? []).length >= 3,
    String((styles.body?.style ?? []).length));

  const bad = await call('/design-suggestions', asJson(mine, { petId, style: 'MAU-LA' }));
  ok('Phong cach ngoai danh sach bi tu choi', bad.status === 400, String(bad.status));

  const asked = await call('/design-suggestions', asJson(mine, { petId, style: 'TRUE_TO_LIFE' }));
  ok('Xin goi y tra ve ban ghi moi', asked.status === 201, String(asked.status));
  const plan = asked.body;
  ok('Nhan duoc nhieu nhat bon phuong an',
    (plan?.option ?? []).length > 0 && plan.option.length <= 4,
    String((plan?.option ?? []).length));

  // Thu vien mo hinh va bang mau that, doc lai tu may chu de doi chieu.
  const colours = await call('/catalog/colors', withToken(mine));
  const codeOk = new Set((colours.body ?? []).map((one) => one.code));
  const zoneOk = new Set(['MAIN_FUR', 'BELLY_FUR', 'EAR', 'TAIL', 'EYE', 'NOSE']);
  let allInside = true;
  for (const one of plan?.option ?? []) {
    for (const paint of one.zonePaint ?? []) {
      if (!codeOk.has(paint.colorCode) || !zoneOk.has(paint.zone)) {
        allInside = false;
      }
    }
  }
  ok('Moi ma mau va moi vung deu co that trong danh muc', allInside);
  ok('Moi lan deu ghi ro la lan that hay lan mau',
    plan?.mode === 'LIVE' || plan?.mode === 'SAMPLE', String(plan?.mode));

  const peek = await call(`/design-suggestions/${plan.code}`, withToken(other));
  ok('Nguoi la khong doc duoc goi y cua nguoi khac', peek.status === 404, String(peek.status));

  const chose = await call(
    `/design-suggestions/${plan.code}/choose`,
    asJson(mine, { optionKey: plan.option[0].key }),
  );
  ok('Chon mot phuong an thi sinh ra ban thiet ke', chose.status === 201, String(chose.status));
  ok('Ban thiet ke mang dung mau nen cua phuong an',
    chose.body?.modelCode === plan.option[0].modelCode,
    `${chose.body?.modelCode} vs ${plan.option[0].modelCode}`);
  ok('Ban thiet ke mang theo mau tung vung',
    (chose.body?.zonePaint ?? []).length === plan.option[0].zonePaint.length,
    String((chose.body?.zonePaint ?? []).length));

  const opened = await call(`/designs/${chose.body._id}`, withToken(mine));
  ok('Ban thiet ke mo duoc o buoc tuy bien', opened.status === 200, String(opened.status));

  const badKey = await call(
    `/design-suggestions/${plan.code}/choose`,
    asJson(mine, { optionKey: 'P99' }),
  );
  ok('Chon phuong an khong co thi bi tu choi', badKey.status === 404, String(badKey.status));

  // ---------- Han muc chan that khi hai yeu cau gui cung luc ----------
  console.log('');
  console.log('Han muc — hai yeu cau gui cung luc');
  const tight = await makeCustomer('hanmuc');
  const tightPet = await makePet(tight, `Bong ${STAMP}`);
  await setQuota(boss, 'designSuggestion', 3);

  const together = await Promise.all(
    Array.from({ length: 6 }, () =>
      call('/design-suggestions', asJson(tight, { petId: tightPet, style: 'SOFT' })),
    ),
  );
  const made = together.filter((one) => one.status === 201).length;
  const barred = together.filter((one) => one.status === 429).length;
  ok('Sau yeu cau cung luc chi ba cai di qua', made === 3, `qua ${made}, chan ${barred}`);
  ok('Cac yeu cau con lai bi bao het han muc', barred === 3, String(barred));

  const counted = await call('/design-suggestions', withToken(tight));
  ok('So ban ghi tren may chu dung bang so luot di qua',
    (counted.body ?? []).length === made, String((counted.body ?? []).length));

  await setQuota(boss, 'designSuggestion', 50);

  // ---------- Muc 16: viet cau chuyen ----------
  console.log('');
  console.log('Muc 16 — Viet cau chuyen');
  await setQuota(boss, 'storyWriting', 50);

  const tones = await call('/pet-stories/tones', withToken(mine));
  ok('Co danh sach giong van chon duoc', (tones.body?.tone ?? []).length >= 3,
    String((tones.body?.tone ?? []).length));

  const wrote = await call(
    '/pet-stories',
    asJson(mine, { petId, tone: 'WARM', notes: 'Be thich nam canh cua so buoi chieu' }),
  );
  ok('Viet duoc mot ban cau chuyen', wrote.status === 201, String(wrote.status));
  ok('Ban dau tien duoc danh so mot', wrote.body?.version === 1, String(wrote.body?.version));
  ok('Ban moi viet duoc danh dau la do may viet',
    wrote.body?.hand === 'MACHINE', String(wrote.body?.hand));
  /*
   * Khi co nha cung cap that, cau chuyen duoc viet bang tieng Viet co dau, nen
   * bo dau truoc khi tim y chu vua nhap.
   */
  ok('Noi dung co nhac y chu vua nhap',
    withoutMarks(String(wrote.body?.content ?? '')).includes('cua so'),
    String(wrote.body?.content ?? '').slice(0, 50));

  const again = await call(`/pet-stories/${wrote.body._id}/rewrite`, asJson(mine, {}));
  ok('Viet lai sinh ra mot ban khac', again.status === 201 && again.body._id !== wrote.body._id,
    String(again.status));
  ok('Ban viet lai duoc danh so hai', again.body?.version === 2, String(again.body?.version));

  const kept = await call(`/pet-stories/${wrote.body._id}`, withToken(mine));
  ok('Ban cu van con nguyen sau khi viet lai', kept.status === 200, String(kept.status));

  const fixed = await call(
    `/pet-stories/${wrote.body._id}`,
    asJson(mine, { title: 'Chieu nang', content: 'Chu tu viet lai doan nay.' }, 'PATCH'),
  );
  ok('Sua tay duoc mot ban', fixed.status === 200, String(fixed.status));
  ok('Ban da sua duoc danh dau la do nguoi viet',
    fixed.body?.hand === 'PERSON', String(fixed.body?.hand));

  // Gan vao mot khoanh khac trong nhat ky.
  const moment = await call(
    '/memories',
    asJson(mine, {
      pet: petId,
      title: 'Buoi chieu dau tien',
      happenedAt: new Date().toISOString(),
      topic: 'EVERYDAY',
    }),
  );
  const attached = await call(
    `/pet-stories/${wrote.body._id}/attach`,
    asJson(mine, { memoryId: moment.body._id }),
  );
  ok('Gan duoc cau chuyen vao mot ky niem', attached.status === 201 || attached.status === 200,
    String(attached.status));

  const page = await call(`/memories/pet/${petId}`, withToken(mine));
  const moved = (page.body?.rows ?? []).find((one) => one._id === moment.body._id);
  ok('Noi dung cau chuyen da nam trong ky niem',
    String(moved?.body ?? '').includes('Chu tu viet lai'),
    String(moved?.body ?? '').slice(0, 40));

  const otherPet = await makePet(other, 'Be cua nguoi la');
  const otherMoment = await call(
    '/memories',
    asJson(other, {
      pet: otherPet,
      title: 'Cua nguoi khac',
      happenedAt: new Date().toISOString(),
      topic: 'EVERYDAY',
    }),
  );
  const crossed = await call(
    `/pet-stories/${again.body._id}/attach`,
    asJson(mine, { memoryId: otherMoment.body._id }),
  );
  ok('Khong gan duoc cau chuyen vao nhat ky cua nha khac',
    crossed.status === 404 || crossed.status === 400, String(crossed.status));

  // ---------- Muc 18: hoi thoai ban day du ----------
  console.log('');
  console.log('Muc 18 — Hoi thoai ban day du');
  const opened2 = await call('/assistant/sessions', asJson(mine, {}));
  ok('Mo duoc mot phien hoi thoai', opened2.status === 201, String(opened2.status));
  const code = opened2.body?.code;
  ok('Phien mo ra o trang thai do may tra loi',
    opened2.body?.state === 'BOT', String(opened2.body?.state));

  const guest = await call('/assistant/sessions', asJson(null, {}));
  /* Phien luon gan voi mot tai khoan, nen nguoi chua dang nhap bi tu choi. */
  ok('Nguoi chua dang nhap khong mo duoc phien', guest.status === 401, String(guest.status));

  const asked1 = await call(`/assistant/sessions/${code}/ask`, asJson(mine, { question: 'Gia bao nhieu?' }));
  ok('Hoi mot cau thi nhan duoc cau tra loi', asked1.status === 200, String(asked1.status));
  const turns1 = asked1.body?.turn ?? [];
  ok('Cau hoi va cau tra loi deu duoc luu lai', turns1.length === 3, String(turns1.length));
  ok('Cau tra loi ve gia co nhac so tien',
    /\d/.test(turns1[turns1.length - 1]?.text ?? ''),
    String(turns1[turns1.length - 1]?.text ?? '').slice(0, 40));

  await call(`/assistant/sessions/${code}/ask`, asJson(mine, { question: 'Lam bao lau?' }));
  const recalled = await call(`/assistant/sessions/${code}`, withToken(mine));
  ok('Phien nho lai ca hai cau da hoi', (recalled.body?.turn ?? []).length === 5,
    String((recalled.body?.turn ?? []).length));

  const stranger = await call(`/assistant/sessions/${code}`, withToken(other));
  ok('Nguoi dang nhap khac khong doc duoc phien cua nguoi nay',
    stranger.status === 403 || stranger.status === 404, String(stranger.status));

  const noSuch = await call(`/assistant/sessions/khong-co-ma-nay`, withToken(mine));
  ok('Ma phien khong co thi bao khong tim thay', noSuch.status === 404, String(noSuch.status));

  // Chuyen sang nguoi that.
  const handed = await call(
    `/assistant/sessions/${code}/handover`,
    asJson(mine, { note: 'Muon hoi ky ve kich co' }),
  );
  ok('Xin gap tu van vien thi phien chuyen sang hang cho',
    handed.body?.state === 'WAITING', String(handed.body?.state));

  const queue = await call('/admin/chats', withToken(support));
  ok('Phien vua xin gap hien ra o trang truc',
    (queue.body ?? []).some((one) => one.code === code), String((queue.body ?? []).length));

  const notStaff = await call('/admin/chats', withToken(mine));
  ok('Khach thuong khong xem duoc hang cho', notStaff.status === 403, String(notStaff.status));

  const deskKnowledge = await call('/admin/assistant/knowledge', withToken(support));
  ok('Nhom CSKH khong mo duoc kho tri thuc cua tro ly', deskKnowledge.status === 403,
    String(deskKnowledge.status));

  const replyEarly = await call(
    `/admin/chats/${code}/reply`,
    asJson(support, { text: 'Chua nhan ma da tra loi' }),
  );
  ok('Chua nhan phien thi chua tra loi duoc', replyEarly.status === 400, String(replyEarly.status));

  const took = await call(`/admin/chats/${code}/take`, asJson(support, {}));
  ok('Nhan vien nhan duoc phien', took.body?.state === 'WITH_STAFF', String(took.body?.state));

  const answered = await call(
    `/admin/chats/${code}/reply`,
    asJson(support, { text: 'Chao ban, minh la tu van vien cua PETMORY.' }),
  );
  ok('Nhan vien tra loi duoc', answered.status === 200, String(answered.status));
  const last = (answered.body?.turn ?? []).slice(-1)[0];
  ok('Luot tra loi duoc ghi la do nhan vien noi', last?.side === 'STAFF', String(last?.side));

  const seen = await call(`/assistant/sessions/${code}`, withToken(mine));
  ok('Khach doc duoc cau tra loi cua nhan vien',
    String((seen.body?.turn ?? []).slice(-1)[0]?.text ?? '').includes('tu van vien'),
    String((seen.body?.turn ?? []).slice(-1)[0]?.text ?? '').slice(0, 40));

  const whileStaff = await call(
    `/assistant/sessions/${code}/ask`,
    asJson(mine, { question: 'Con size nao khong?' }),
  );
  const botTurn = (whileStaff.body?.turn ?? []).slice(-1)[0];
  ok('Khi nhan vien dang tra loi thi may khong chen vao giua',
    String(botTurn?.text ?? '').includes('tư vấn viên'),
    String(botTurn?.text ?? '').slice(0, 40));

  const closed = await call(`/admin/chats/${code}/close`, asJson(support, {}));
  ok('Khep duoc phien lai', closed.body?.state === 'CLOSED', String(closed.body?.state));

  const afterClose = await call(
    `/assistant/sessions/${code}/ask`,
    asJson(mine, { question: 'Hoi them duoc khong?' }),
  );
  ok('Phien da khep thi khong hoi tiep duoc', afterClose.status === 400, String(afterClose.status));

  const reopen = await call(`/admin/chats/${code}/take`, asJson(support, {}));
  ok('Phien da khep thi khong nhan lai duoc', reopen.status === 400, String(reopen.status));

  // ---------- Ghi mot han muc khong duoc lam mat cac han muc con lai ----------
  console.log('');
  console.log('Tham so — ghi mot muc khong lam mat muc khac');
  await setQuota(boss, 'designSuggestion', 50);
  const wholeBefore = await call('/settings', withToken(boss));
  const onlyOne = await call(
    '/settings',
    asJson(boss, { aiQuota: { restorePhoto: { day: 21, month: 301, year: 3001 } } }, 'PATCH'),
  );
  ok('Ghi rieng mot han muc thi may chu nhan', onlyOne.status === 200, String(onlyOne.status));
  const wholeAfter = await call('/settings', withToken(boss));
  ok('Han muc goi y thiet ke khong bi mat',
    Boolean(wholeAfter.body?.aiQuota?.designSuggestion),
    JSON.stringify(wholeAfter.body?.aiQuota?.designSuggestion));
  ok('Han muc viet cau chuyen khong bi mat',
    Boolean(wholeAfter.body?.aiQuota?.storyWriting),
    JSON.stringify(wholeAfter.body?.aiQuota?.storyWriting));
  ok('Han muc tra loi hoi thoai khong bi mat',
    Boolean(wholeAfter.body?.aiQuota?.chatReply),
    JSON.stringify(wholeAfter.body?.aiQuota?.chatReply));
  ok('Muc vua ghi doi dung theo', wholeAfter.body?.aiQuota?.restorePhoto?.day === 21,
    String(wholeAfter.body?.aiQuota?.restorePhoto?.day));
  await call(
    '/settings',
    asJson(boss, { aiQuota: { restorePhoto: wholeBefore.body.aiQuota.restorePhoto } }, 'PATCH'),
  );

  // ---------- Chi phi ghi vao bao cao ----------
  console.log('');
  console.log('Chi phi — moi luot deu vao bao cao');
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const cost = await call(`/admin/reports/ai-cost?from=${from}&to=${to}`, withToken(boss));
  const rowOf = (kind) => (cost.body?.rows ?? []).find((one) => one.kind === kind);
  ok('Bao cao co dong cho goi y thiet ke',
    (rowOf('designSuggestion')?.count ?? 0) > 0, String(rowOf('designSuggestion')?.count));
  ok('Bao cao co dong cho viet cau chuyen',
    (rowOf('storyWriting')?.count ?? 0) > 0, String(rowOf('storyWriting')?.count));

  console.log('');
  console.log('-'.repeat(64));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed} MUC HONG, ${passed} MUC PASS`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
