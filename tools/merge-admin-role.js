/**
 * Gop nhom Quan tri vien vao nhom Quan ly.
 *
 * He thong chi con mot nhom quan ly chung: nhom Quan ly lo ca van hanh lan
 * tai khoan. Moi tai khoan dang mang nhom Quan tri vien, ke ca tai khoan mang
 * ca hai nhom, chi con lai nhom Quan ly. Cac ma dang nhap cu cua nhung tai
 * khoan bi doi deu bi bo, va moi lan doi duoc ghi vao nhat ky thao tac.
 *
 * Khach hang va nhom Cham soc khach hang khong bi dung toi.
 *
 * Chay: node tools/merge-admin-role.js          xem se doi nhung gi
 *       node tools/merge-admin-role.js --thuc   doi that
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');

const ROLE_MANAGER = 'MANAGER';
const ROLE_ADMIN = 'ADMIN';

/**
 * Dia chi co so du lieu dang dung.
 *
 * Uu tien bien moi truong, roi moi den tep cau hinh, de bai nay doc dung co so
 * du lieu ma may chu dang chay.
 */
function mongoUri() {
  const fromEnv = (process.env.MONGODB_URI || '').trim();
  if (fromEnv !== '') {
    return fromEnv;
  }
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) {
    return '';
  }
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((one) => one.trim().startsWith('MONGODB_URI='));
  return line ? line.slice(line.indexOf('=') + 1).trim() : '';
}

/** Nhom quyen moi: bo nhom Quan tri vien, them nhom Quan ly neu chua co. */
function rolesAfter(roles) {
  const kept = roles.filter((one) => one !== ROLE_ADMIN);
  return kept.includes(ROLE_MANAGER) ? kept : [ROLE_MANAGER, ...kept];
}

async function run() {
  const real = process.argv.includes('--thuc');
  const uri = mongoUri();
  if (uri === '') {
    throw new Error('chua co dia chi co so du lieu');
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const users = db.collection('users');

  console.log(real ? 'GOP NHOM QUAN TRI VIEN VAO NHOM QUAN LY (DOI THAT)' : 'GOP NHOM QUAN TRI VIEN VAO NHOM QUAN LY (CHAY THU)');
  console.log('-'.repeat(64));

  const found = await users.find({ roles: ROLE_ADMIN }).project({ email: 1, roles: 1 }).toArray();
  for (const one of found) {
    console.log(`  ${one.email.padEnd(30)} ${one.roles.join('+').padEnd(16)} -> ${rolesAfter(one.roles).join('+')}`);
  }
  if (found.length === 0) {
    console.log('  khong tai khoan nao phai doi');
  }

  if (!real) {
    console.log('');
    console.log('Chay lai kem --thuc de doi that.');
    await client.close();
    return;
  }

  const now = new Date();
  for (const one of found) {
    const next = rolesAfter(one.roles);
    await users.updateOne({ _id: one._id }, { $set: { roles: next }, $inc: { tokenEpoch: 1 } });
    await db.collection('audit_logs').insertOne({
      actor: null,
      action: 'ACCOUNT_ROLE_CHANGED',
      resourceType: 'User',
      resourceId: one._id.toString(),
      before: { roles: one.roles },
      after: { roles: next },
      ipAddress: '',
      reason: 'Gop nhom Quan tri vien vao nhom Quan ly',
      createdAt: now,
    });
  }

  const after = await users
    .aggregate([{ $unwind: '$roles' }, { $group: { _id: '$roles', n: { $sum: 1 } } }])
    .toArray();
  console.log('');
  console.log('Sau khi doi:');
  for (const one of after.sort((a, b) => b.n - a.n)) {
    console.log(`  ${String(one._id).padEnd(12)} ${one.n} tai khoan`);
  }
  await client.close();
  console.log('-'.repeat(64));
  console.log('Xong. Cac ma dang nhap cu cua nhung tai khoan vua doi deu da bi bo.');
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
