/**
 * Chuyen cac tai khoan dang co sang ba nhom quyen moi.
 *
 * Truoc day co bon nhom. Nhom Cham soc khach hang bi bo, va nhom Quan tri vien
 * doi y nghia: truoc la dieu phoi xuong, nay chi quan ly tai khoan.
 *
 * Cach chuyen:
 * - Ai dang o nhom Cham soc khach hang chuyen sang nhom Quan ly, vi cong viec
 *   truc hoi thoai nay thuoc nhom Quan ly.
 * - Ai dang o nhom Quan tri vien chuyen sang nhom Quan ly, vi ho dang lo don
 *   hang chu khong lo tai khoan.
 * - Ai dang o ca hai nhom Quan ly va Quan tri vien thi giu nhom Quan ly.
 * - Sau do bao dam co it nhat mot tai khoan nhom Quan tri vien moi.
 *
 * Khach hang khong bi dung toi.
 *
 * Chay: node tools/migrate-roles.js          xem se doi nhung gi
 *       node tools/migrate-roles.js --thuc   doi that
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');

/** Tai khoan se mang nhom Quan tri vien moi neu chua co ai. */
const ADMIN_EMAIL = 'quantri@petmory.local';

/** Ten ba nhom quyen, gom lai mot cho. */
const ROLE_MANAGER = 'MANAGER';
const ROLE_ADMIN = 'ADMIN';
const ROLE_CUSTOMER = 'CUSTOMER';

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

/** Nhom quyen moi cua mot tai khoan, theo cac nhom cu cua no. */
function roleFor(roles) {
  const had = new Set(roles ?? []);
  if (had.has(ROLE_CUSTOMER) && had.size === 1) {
    return ROLE_CUSTOMER;
  }
  if (had.has(ROLE_MANAGER) || had.has(ROLE_ADMIN) || had.has('SUPPORT')) {
    return ROLE_MANAGER;
  }
  return ROLE_CUSTOMER;
}

async function run() {
  const real = process.argv.includes('--thuc');
  const uri = mongoUri();
  if (!uri) {
    console.log('Khong tim thay dia chi co so du lieu.');
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const db = client.db();
  const users = db.collection('users');

  console.log('CHUYEN TAI KHOAN SANG BA NHOM QUYEN');
  console.log('='.repeat(64));

  const staff = await users.find({ roles: { $nin: [[ROLE_CUSTOMER]] } }).toArray();
  const changes = [];
  for (const one of staff) {
    const now = one.roles ?? [];
    /*
     * Tai khoan danh rieng cho viec quan ly tai khoan thi giu nguyen.
     *
     * Nhom Quan tri vien cu va moi trung ten nhau nhung khac viec, nen khong
     * the nhin nhom quyen ma biet. Dia chi thu la dau hieu duy nhat phan biet
     * duoc, va bo qua o day thi chay lai bai nay bao nhieu lan cung ra mot
     * ket qua.
     */
    if (one.email === ADMIN_EMAIL) {
      continue;
    }
    const next = roleFor(now);
    if (now.length === 1 && now[0] === next) {
      continue;
    }
    changes.push({ id: one._id, email: one.email, from: now.join('+'), to: next });
  }

  for (const one of changes) {
    console.log(`  ${one.email.padEnd(30)} ${one.from.padEnd(16)} -> ${one.to}`);
  }
  if (changes.length === 0) {
    console.log('  khong tai khoan nao phai doi');
  }

  if (!real) {
    console.log('');
    console.log('Chay lai kem --thuc de doi that.');
    await client.close();
    return;
  }

  for (const one of changes) {
    await users.updateOne(
      { _id: one.id },
      { $set: { roles: [one.to] }, $inc: { tokenEpoch: 1 } },
    );
  }

  /*
   * Bao dam con it nhat mot nguoi quan tri.
   *
   * Sau buoc tren, moi nguoi noi bo deu ve nhom Quan ly, nen neu khong lam
   * buoc nay thi khong con ai tao duoc tai khoan nua.
   */
  const adminLeft = await users.countDocuments({ roles: ROLE_ADMIN, active: true });
  if (adminLeft === 0) {
    const picked = await users.findOne({ email: ADMIN_EMAIL });
    if (picked) {
      await users.updateOne(
        { _id: picked._id },
        { $set: { roles: [ROLE_ADMIN] }, $inc: { tokenEpoch: 1 } },
      );
      console.log('');
      console.log(`  dat ${ADMIN_EMAIL} lam nhom Quan tri vien`);
    } else {
      console.log('');
      console.log(`  CHUA CO nguoi quan tri nao. Hay chay lenh gieo du lieu mau de tao ${ADMIN_EMAIL}.`);
    }
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
