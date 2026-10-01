/**
 * Kiem thu phan hoan thien nhat ky ky niem (Phu luc 01 muc 17).
 *
 * Bao gom: gan anh vao khoanh khac, che do rieng tu va cong khai, duong dan
 * chia se, va xuat tep. Moi muc deu duoc doc lai tu may chu, khong tin vao
 * cau tra loi cua chinh lenh vua goi.
 *
 * Chay: node tools/test-diary-api.js
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const PASSWORD = 'Password@123';

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

/** Mot tai khoan khach moi, kem mot be. */
async function makeOwner(tag) {
  const email = `nk.${tag}.${STAMP}@petmory.local`;
  const signUp = await call('/auth/register', asJson(null, {
    email, password: PASSWORD, fullName: `Chu nhat ky ${tag}`,
  }));
  const token = signUp.body.accessToken;
  const pet = await call('/pets', asJson(token, { name: `Be ${tag} ${STAMP}`, kind: 'DOG' }));
  return { email, token, petId: pet.body._id };
}

/** Gui mot buc anh vao album cua mot be va tra ve ma anh. */
async function sendPhoto(token, petId, tint) {
  const bytes = await sharp({ create: { width: 900, height: 700, channels: 3, background: tint } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'anh.png');
  const answer = await fetch(`${API}/pet-photos/${petId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  const body = await answer.json();
  if (!body._id) {
    throw new Error(`Khong gui duoc anh: ${answer.status} ${JSON.stringify(body).slice(0, 160)}`);
  }
  return body._id;
}

async function run() {
  console.log('NHAT KY KY NIEM: ANH, CHE DO, CHIA SE, XUAT TEP');
  console.log('='.repeat(66));

  const mine = await makeOwner('a');
  const other = await makeOwner('b');

  // --- Gan anh vao khoanh khac ---
  const photoOne = await sendPhoto(mine.token, mine.petId, { r: 220, g: 170, b: 130 });
  const photoTwo = await sendPhoto(mine.token, mine.petId, { r: 130, g: 180, b: 220 });
  const photoThree = await sendPhoto(mine.token, mine.petId, { r: 170, g: 210, b: 160 });
  const strange = await sendPhoto(other.token, other.petId, { r: 200, g: 200, b: 200 });
  ok('Chuan bi duoc bon buc anh',
    Boolean(photoOne && photoTwo && photoThree && strange));

  const moment = await call('/memories', asJson(mine.token, {
    pet: mine.petId,
    title: 'Ngay dau ve nha',
    body: 'Be nam ngu ca buoi chieu',
    happenedAt: new Date('2024-03-05T09:00:00Z').toISOString(),
    place: 'Ha Noi',
    topic: 'FIRST_DAY',
    photo: [photoOne, photoTwo, photoThree],
  }));
  ok('Gan duoc ba anh vao mot khoanh khac',
    moment.status === 201 && moment.body.photo.length === 3,
    `${moment.status} / ${moment.body?.photo?.length}`);

  const stolen = await call('/memories', asJson(mine.token, {
    pet: mine.petId,
    title: 'Anh cua nha khac',
    happenedAt: new Date().toISOString(),
    photo: [strange],
  }));
  ok('Khong gan duoc anh cua be nha khac', stolen.status === 400, String(stolen.status));

  // --- NT-17.1 Xoa mot anh khoi album thi khoanh khac con lai hai ---
  await call(`/pet-photos/${photoThree}`, { method: 'DELETE', ...withToken(mine.token) });
  await call(`/memories/pet/${mine.petId}/privacy`, asJson(mine.token, { isPublic: true }, 'PATCH'));
  const afterDrop = await call(`/diaries/${mine.petId}`);
  const shown = afterDrop.body?.photo?.length ?? -1;
  ok('Xoa mot anh khoi album thi khoanh khac chi con hai anh', shown === 2, String(shown));
  ok('Khoanh khac van mo duoc sau khi mat mot anh',
    (afterDrop.body?.moments?.length ?? 0) === 1);

  // --- NT-17.2 va NT-17.3 Che do rieng tu ---
  const hiddenBook = await call(`/diaries/${other.petId}`);
  ok('Quyen rieng tu khong mo duoc tu ben ngoai', hiddenBook.status === 404,
    String(hiddenBook.status));
  const feed = await call('/diaries');
  const inFeed = (feed.body?.rows ?? []).some((one) => one.petId === mine.petId);
  const otherInFeed = (feed.body?.rows ?? []).some((one) => one.petId === other.petId);
  ok('Quyen cong khai hien o trang cong dong', inFeed);
  ok('Quyen rieng tu khong hien o trang cong dong', !otherInFeed);
  ok('Nguoi chua dang nhap doc duoc quyen cong khai',
    afterDrop.status === 200 && afterDrop.body.moments.length === 1);

  // --- NT-17.4 Khong lo du lieu dinh danh ---
  await call(`/pets/${mine.petId}`, asJson(mine.token, {
    microchip: '900123456789012',
    carer: [{ name: 'Nguoi cham soc that', role: 'Me nuoi' }],
  }, 'PATCH'));
  const afterChip = await call(`/diaries/${mine.petId}`);
  const asText = JSON.stringify(afterChip.body);
  ok('Quyen cong khai khong lo ma chip', !asText.includes('900123456789012'));
  ok('Quyen cong khai khong lo ten nguoi cham soc', !asText.includes('Nguoi cham soc that'));

  // --- Duong dan chia se ---
  const shareOne = await call(`/memories/pet/${mine.petId}/shares`, asJson(mine.token, {}));
  const shareTwo = await call(`/memories/pet/${mine.petId}/shares`, asJson(mine.token, {}));
  ok('Tao duoc hai duong dan chia se',
    shareOne.status === 201 && shareTwo.status === 201 &&
      shareOne.body.code !== shareTwo.body.code);
  ok('Ma chia se du dai de khong doan duoc',
    (shareOne.body?.code ?? '').length >= 40, String(shareOne.body?.code?.length));

  const listed = await call(`/memories/pet/${mine.petId}/shares`, withToken(mine.token));
  const asShareText = JSON.stringify(listed.body);
  ok('Danh sach duong dan khong tra lai ma nguyen van',
    !asShareText.includes(shareOne.body.code));
  ok('Danh sach duong dan co ngay tao va so luot xem',
    (listed.body ?? []).every((one) => 'viewCount' in one && 'createdAt' in one));

  const bySharedLink = await call(`/diaries/share/${shareOne.body.code}`);
  ok('Nguoi cam duong dan doc duoc ma khong can dang nhap',
    bySharedLink.status === 200 && bySharedLink.body.moments.length === 1,
    String(bySharedLink.status));

  const junkLink = await call('/diaries/share/khongcothat');
  ok('Ma chia se bia dat tra ve khong tim thay', junkLink.status === 404,
    String(junkLink.status));

  // --- NT-17.8 Thu hoi mot duong dan, duong con lai van dung duoc ---
  await call(`/memories/shares/${shareOne.body.share._id}`, {
    method: 'DELETE', ...withToken(mine.token),
  });
  const afterRevoke = await call(`/diaries/share/${shareOne.body.code}`);
  ok('Duong dan da thu hoi tra ve khong tim thay', afterRevoke.status === 404,
    String(afterRevoke.status));
  const stillGood = await call(`/diaries/share/${shareTwo.body.code}`);
  ok('Duong dan con lai van dung duoc', stillGood.status === 200, String(stillGood.status));

  // --- NT-17.5 Rut ve rieng tu thi moi duong dan het hieu luc ---
  await call(`/memories/pet/${mine.petId}/privacy`, asJson(mine.token, { isPublic: false }, 'PATCH'));
  const afterPrivate = await call(`/diaries/share/${shareTwo.body.code}`);
  ok('Rut ve rieng tu thi duong dan dang mo het hieu luc ngay',
    afterPrivate.status === 404, String(afterPrivate.status));
  const goneFromFeed = await call('/diaries');
  ok('Rut ve rieng tu thi bien khoi trang cong dong',
    !(goneFromFeed.body?.rows ?? []).some((one) => one.petId === mine.petId));

  // --- Nguoi khac khong dung duoc duong quan ly cua quyen nay ---
  const notMine = await call(`/memories/pet/${mine.petId}/shares`, asJson(other.token, {}));
  ok('Nguoi khac khong tao duoc duong dan cho quyen cua ta',
    notMine.status === 404, String(notMine.status));

  // --- NT-17.6 Xuat tep ---
  await call(`/memories/pet/${mine.petId}/privacy`, asJson(mine.token, { isPublic: true }, 'PATCH'));
  const asked = await call(`/memories/pet/${mine.petId}/exports`, asJson(mine.token, {}));
  ok('Xin xuat tep thi nhan duoc ma theo doi ngay',
    asked.status === 201 && asked.body.state === 'PENDING', String(asked.body?.state));

  let job = asked.body;
  for (let i = 0; i < 60 && job.state === 'PENDING'; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    job = (await call(`/memories/exports/${asked.body._id}`, withToken(mine.token))).body;
  }
  ok('Tep duoc dung xong', job.state === 'READY', `${job.state} ${job.problem ?? ''}`);
  ok('Tep ghi dung so khoanh khac', job.momentCount === 1, String(job.momentCount));

  const file = await fetch(`${API}/memories/exports/${asked.body._id}/file`, withToken(mine.token));
  const bytes = Buffer.from(await file.arrayBuffer());
  ok('Tai duoc tep da xuat', file.status === 200 && bytes.length > 1000,
    `${file.status}, ${bytes.length} byte`);
  ok('Tep tai ve dung la mot tep PDF', bytes.slice(0, 5).toString() === '%PDF-',
    bytes.slice(0, 5).toString());
  /*
   * Dem so anh that su nam trong tep thay vi doan theo do lon cua tep. Mot
   * buc anh mot mau nen lai rat nho, nen lay do lon lam thuoc do thi bai
   * kiem thu se bao hong oan du tep hoan toan dung.
   */
  const asBinary = bytes.toString('latin1');
  const imageCount = (asBinary.match(/\/Subtype\s*\/Image/g) ?? []).length;
  ok('Tep mang dung hai buc anh cua khoanh khac', imageCount === 2, `${imageCount} anh`);

  // --- NT-17.7 Nguoi khac khong tai duoc tep ---
  const theirTry = await call(`/memories/exports/${asked.body._id}/file`, withToken(other.token));
  ok('Tai khoan khac khong tai duoc tep da xuat', theirTry.status === 404,
    String(theirTry.status));

  // --- Quan tri vien an mot quyen ---
  const boss = await call('/auth/login', asJson(null, {
    email: 'quanly@petmory.local', password: 'Petmory@2026',
  }));
  const bossToken = boss.body.accessToken;
  const noReason = await call(`/admin/diaries/${mine.petId}/block`,
    asJson(bossToken, {}, 'PATCH'));
  ok('An quyen ma khong ghi ly do thi bi chan', noReason.status === 400,
    String(noReason.status));

  const blocked = await call(`/admin/diaries/${mine.petId}/block`,
    asJson(bossToken, { reason: 'Noi dung khong phu hop voi trang' }, 'PATCH'));
  ok('Quan tri vien an duoc mot quyen', blocked.status === 200, String(blocked.status));
  const afterBlock = await call(`/diaries/${mine.petId}`);
  ok('Quyen bi an thi khach khong doc duoc nua', afterBlock.status === 404,
    String(afterBlock.status));
  const ownerStill = await call(`/memories/pet/${mine.petId}`, withToken(mine.token));
  ok('Chu quyen van doc duoc nhat ky cua minh', ownerStill.status === 200,
    String(ownerStill.status));
  const ownerSees = await call(`/pets/${mine.petId}`, withToken(mine.token));
  ok('Chu quyen doc duoc ly do bi an',
    (ownerSees.body?.diaryBlockReason ?? '').includes('khong phu hop'),
    ownerSees.body?.diaryBlockReason ?? '');

  const plainTry = await call(`/admin/diaries/${other.petId}/block`,
    asJson(mine.token, { reason: 'Khong duoc phep lam dieu nay' }, 'PATCH'));
  ok('Tai khoan thuong khong goi duoc duong an quyen', plainTry.status === 403,
    String(plainTry.status));

  console.log('='.repeat(66));
  console.log(failed === 0 ? `TAT CA ${passed} MUC DEU PASS` : `${failed}/${passed + failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
