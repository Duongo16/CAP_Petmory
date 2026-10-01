/**
 * Kiem thu viec khoi phuc mat khau qua email (Phu luc 01 muc 1).
 *
 * O muc chay thu, may chu ghi duong dan dat lai ra nhat ky thay vi gui thu
 * that, dung theo khoan 3.5. Bai kiem thu nay khong doc nhat ky — no doc thang
 * ban ghi trong co so du lieu, vi day la thu duy nhat chac chan, va vi ma gui
 * di khong bao gio duoc luu nguyen van nen phai so sanh bang chinh ban bam.
 *
 * Chay: node tools/test-password-recovery.js
 */
const fs = require('fs');
const path = require('path');
const { createHash, randomBytes } = require('node:crypto');
const { MongoClient } = require('mongodb');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const PASSWORD_OLD = 'Password@123';
const PASSWORD_NEW = 'MatKhauMoi@456';

function ok(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${note ? '  ' + note : ''}`);
  return passed;
}

function readEnv() {
  const file = path.join(__dirname, '..', '.env');
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      out[trimmed.slice(0, trimmed.indexOf('='))] = trimmed.slice(trimmed.indexOf('=') + 1);
    }
  }
  return out;
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

const asJson = (data) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(data),
});

/**
 * Dat mot ma moi cho tai khoan va tra ve ma nguyen van.
 *
 * Xin qua API thi ma chi nam trong nhat ky may chu, bai kiem thu khong voi
 * toi duoc. O day ta tu sinh ma va ghi ban bam vao dung cho may chu se tim,
 * tuc la di dung con duong ma chuc nang that su dung.
 */
async function plantCode(resets, owner, minutesLeft) {
  const code = randomBytes(32).toString('hex');
  await resets.insertOne({
    owner,
    codeHash: createHash('sha256').update(code).digest('hex'),
    expiresAt: new Date(Date.now() + minutesLeft * 60_000),
    usedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return code;
}

async function run() {
  console.log('KHOI PHUC MAT KHAU');
  console.log('='.repeat(64));

  const env = { ...readEnv(), ...process.env };
  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db();
  const users = db.collection('users');
  const resets = db.collection('password_resets');

  const res = [];
  try {
    const email = `quen.${Date.now()}@petmory.local`;
    await call('/auth/register', asJson({ email, password: PASSWORD_OLD, fullName: 'Quen mat khau' }));
    const first = await call('/auth/login', asJson({ email, password: PASSWORD_OLD }));
    res.push(ok('Dang nhap duoc bang mat khau cu', Boolean(first.body?.accessToken)));
    const oldToken = first.body.accessToken;

    const me = await users.findOne({ email });
    res.push(ok('Tai khoan da duoc tao', Boolean(me), String(me?._id)));

    // --- Khong he lo ai da dang ky ---
    const real = await call('/auth/forgot-password', asJson({ email }));
    const fake = await call('/auth/forgot-password', asJson({ email: `khong.${Date.now()}@petmory.local` }));
    res.push(ok('Dia chi co that va khong co that tra loi giong het nhau',
      real.status === fake.status && real.text === fake.text, `${real.status} / ${fake.status}`));
    res.push(ok('Cau tra loi khong chua ma dat lai',
      !/token|code/i.test(real.text), real.text.slice(0, 60)));

    // --- Ma duoc luu o dang bam, khong luu nguyen van ---
    const saved = await resets.findOne({ owner: me._id });
    res.push(ok('Co ban ghi yeu cau dat lai', Boolean(saved)));
    res.push(ok('Ma duoc luu o dang bam, khong nguyen van',
      Boolean(saved?.codeHash) && saved.codeHash.length === 64 && !saved.token && !saved.code));

    // --- Ma het han bi tu choi ---
    const stale = await plantCode(resets, me._id, -1);
    const staleTry = await call('/auth/reset-password', asJson({ token: stale, password: PASSWORD_NEW }));
    res.push(ok('Ma da het han bi tu choi', staleTry.status === 400, String(staleTry.status)));

    // --- Ma bia bi tu choi ---
    const junk = await call('/auth/reset-password',
      asJson({ token: randomBytes(32).toString('hex'), password: PASSWORD_NEW }));
    res.push(ok('Ma bia dat bi tu choi', junk.status === 400, String(junk.status)));

    // --- Doi mat khau that ---
    const good = await plantCode(resets, me._id, 30);
    const spare = await plantCode(resets, me._id, 30);
    const done = await call('/auth/reset-password', asJson({ token: good, password: PASSWORD_NEW }));
    res.push(ok('Doi duoc mat khau bang ma con han', done.status === 200, String(done.status)));

    const oldWay = await call('/auth/login', asJson({ email, password: PASSWORD_OLD }));
    res.push(ok('Mat khau cu khong dang nhap duoc nua', oldWay.status === 401, String(oldWay.status)));
    const newWay = await call('/auth/login', asJson({ email, password: PASSWORD_NEW }));
    res.push(ok('Mat khau moi dang nhap duoc', Boolean(newWay.body?.accessToken)));

    // --- Ma chi dung duoc mot lan ---
    const twice = await call('/auth/reset-password', asJson({ token: good, password: 'LanHai@789' }));
    res.push(ok('Cung mot ma khong dung duoc lan hai', twice.status === 400, String(twice.status)));

    // --- Doi mat khau huy moi ma con lai ---
    const leftover = await call('/auth/reset-password', asJson({ token: spare, password: 'LanBa@789' }));
    res.push(ok('Cac ma con lai cung bi huy theo', leftover.status === 400, String(leftover.status)));

    // --- Doi mat khau day moi phien dang mo ra ngoai ---
    const oldSession = await call('/auth/me', { headers: { authorization: `Bearer ${oldToken}` } });
    res.push(ok('Phien dang mo truoc do bi day ra', oldSession.status === 401, String(oldSession.status)));
    const newSession = await call('/auth/me', {
      headers: { authorization: `Bearer ${newWay.body.accessToken}` },
    });
    res.push(ok('Phien vua dang nhap van dung duoc', newSession.status === 200, String(newSession.status)));

    // --- Chan xin lai qua nhieu lan ---
    await resets.deleteMany({ owner: me._id });
    for (let i = 0; i < 5; i += 1) {
      await call('/auth/forgot-password', asJson({ email }));
    }
    const countBefore = await resets.countDocuments({ owner: me._id });
    await call('/auth/forgot-password', asJson({ email }));
    const countAfter = await resets.countDocuments({ owner: me._id });
    res.push(ok('Xin lan thu sau trong mot gio khong sinh them ma',
      countBefore === 5 && countAfter === 5, `${countBefore} -> ${countAfter}`));

    // --- Mat khau moi phai du dai ---
    const weak = await plantCode(resets, me._id, 30);
    const tooShort = await call('/auth/reset-password', asJson({ token: weak, password: 'ngan' }));
    res.push(ok('Mat khau moi qua ngan bi tu choi', tooShort.status === 400, String(tooShort.status)));
  } finally {
    await client.close();
  }

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `TAT CA ${res.length} MUC DEU PASS` : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
