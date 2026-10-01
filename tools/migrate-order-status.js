/**
 * Doi trang thai don hang cu sang bo trang thai da rut gon.
 *
 * Bo cu co muoi trang thai, bo moi con sau. Bai nay doi cac ban ghi dang mang
 * trang thai khong con ton tai sang trang thai tuong duong gan nhat, va ghi lai
 * viec do vao so kiem toan de con doi chieu duoc ve sau.
 *
 * Chay: node tools/migrate-order-status.js
 * Them --thu o cuoi de chi dem chu khong ghi gi.
 */
const { MongoClient } = require('mongodb');

const URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/petmory';
const DRY = process.argv.includes('--thu');

/** Trang thai cu va trang thai moi thay cho no. */
const MOVE = {
  PAYMENT_EXPIRED: 'CANCELLED',
  QUALITY_CHECK: 'IN_PRODUCTION',
  READY_TO_SHIP: 'IN_PRODUCTION',
  DELIVERED: 'COMPLETED',
};

/** Ly do ghi vao so kiem toan. */
const REASON = 'Rut gon bo trang thai don hang';

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const orders = db.collection('orders');

  console.log(DRY ? 'CHE DO THU — khong ghi gi\n' : 'CHE DO THAT — se ghi vao co so du lieu\n');

  const before = await orders
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();
  console.log('Truoc khi doi:');
  for (const row of before) {
    console.log(`  ${String(row._id).padEnd(18)} ${row.count}`);
  }

  let moved = 0;
  for (const [from, to] of Object.entries(MOVE)) {
    const count = await orders.countDocuments({ status: from });
    if (count === 0) {
      continue;
    }
    console.log(`\n${from} -> ${to}: ${count} don`);
    if (DRY) {
      moved += count;
      continue;
    }

    /*
     * Ghi vet vao tung don truoc khi doi, de sau nay con biet don do von o
     * trang thai nao. Truong nay chi de tra cuu, khong duong nao doc no.
     */
    const result = await orders.updateMany(
      { status: from },
      { $set: { status: to, statusBeforeMerge: from } },
    );
    moved += result.modifiedCount;
  }

  if (!DRY && moved > 0) {
    await db.collection('auditlogs').insertOne({
      actor: null,
      action: 'ORDER_STATUS_MIGRATED',
      resourceType: 'ORDER',
      resourceId: 'ALL',
      after: { moved, map: MOVE, reason: REASON },
      createdAt: new Date(),
    });
  }

  const after = await orders
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }])
    .toArray();
  console.log('\nSau khi doi:');
  for (const row of after) {
    console.log(`  ${String(row._id).padEnd(18)} ${row.count}`);
  }

  const left = after.filter((row) => Object.keys(MOVE).includes(String(row._id)));
  console.log('');
  if (DRY) {
    console.log(`Se doi ${moved} don. Chay lai khong kem --thu de ghi that.`);
  } else if (left.length > 0) {
    console.log('VAN CON DON O TRANG THAI CU:', left.map((row) => row._id).join(', '));
    process.exitCode = 1;
  } else {
    console.log(`Da doi ${moved} don. Khong con don nao o trang thai cu.`);
  }

  await client.close();
})().catch((trouble) => {
  console.error('Hong:', trouble.message);
  process.exit(1);
});
