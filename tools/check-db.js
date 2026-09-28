/**
 * Checks the database the API is configured to use.
 *
 * Prints where it is pointing, whether it answers, what is stored, and whether
 * the unique indexes that stop money being processed twice are actually there.
 * Works the same against the local container and against a cloud cluster, so it
 * is the one command to run after moving the database.
 *
 * Run: node tools/check-db.js
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

/** The unique indexes the system relies on. Missing any of these is a defect. */
const INDEXES_REQUIRED = [
  ['payment_notifications', 'transactionId'],
  ['orders', 'orderCode'],
  ['orders', 'reference'],
  ['users', 'email'],
  ['carts', 'owner'],
  ['product_types', 'code'],
  ['color_codes', 'code'],
  ['display_bases', 'code'],
  ['favourites', 'owner_1_productTypeCode_1'],
  ['product_reviews', 'owner_1_productTypeCode_1_orderCode_1'],
  ['community_likes', 'post_1_owner_1'],
  ['community_saved', 'post_1_owner_1'],
  ['community_follows', 'follower_1_following_1'],
];

/** The collections the seed fills. Empty ones mean the seed has not been run. */
const SEEDED = ['product_types', 'color_codes', 'display_bases', 'business_config', 'users'];

let failed = 0;
let warned = 0;

function pass(text) {
  console.log(`  PASS   ${text}`);
}

function warn(text) {
  warned += 1;
  console.log(`  NOTE   ${text}`);
}

function fail(text) {
  failed += 1;
  console.log(`  FAIL   ${text}`);
}

/** Reads MONGODB_URI out of the .env file without pulling in a library. */
function readUri() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) {
    return null;
  }
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('MONGODB_URI='));
  return line ? line.slice(line.indexOf('=') + 1).trim() : null;
}

/** The address with the password blanked out, so it is safe to paste anywhere. */
function safeUri(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:********@');
}

/** The database name the address points at, which decides where data lands. */
function databaseName(uri) {
  const afterHost = uri.split('://')[1]?.split('/')[1] ?? '';
  const name = afterHost.split('?')[0];
  return name || null;
}

function checkAddress(uri) {
  const cloud = uri.startsWith('mongodb+srv://');
  console.log(`  Address  : ${safeUri(uri)}`);
  console.log(`  Kind     : ${cloud ? 'cloud cluster' : 'direct connection'}`);

  const name = databaseName(uri);
  if (!name) {
    fail('the address names no database, so everything would land in "test"');
  } else {
    pass(`the address names the database "${name}"`);
  }

  if (cloud && /replicaSet=|directConnection=/.test(uri)) {
    fail('a cloud address must not carry replicaSet or directConnection');
  }
  if (!cloud && !/replicaSet=/.test(uri)) {
    warn('a direct address with no replica set cannot use transactions');
  }
  // Only look at the password when the address actually carries credentials,
  // which is what the at sign before the host marks.
  const credentials = uri.match(/:\/\/([^/@]+)@/);
  if (credentials && /[:/?#[\]@]/.test(credentials[1].split(':').slice(1).join(':'))) {
    warn('the password holds a character that must be percent encoded');
  }
  return name;
}

async function run() {
  console.log('DATABASE CHECK');
  console.log('='.repeat(72));

  const uri = readUri();
  if (!uri) {
    console.log('  FAIL   no MONGODB_URI found, in the environment or in .env');
    process.exit(1);
  }

  const name = checkAddress(uri);

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  const started = Date.now();
  try {
    await client.connect();
  } catch (error) {
    fail(`could not connect: ${error.message}`);
    console.log('');
    console.log('='.repeat(72));
    console.log('CANNOT REACH THE DATABASE');
    process.exit(1);
  }
  const took = Date.now() - started;
  pass(`connected in ${took} ms`);
  if (took > 2000) {
    warn('the connection took a while, which every request will now also pay');
  }

  const db = client.db(name ?? undefined);

  const info = await db.admin().serverStatus().catch(() => null);
  if (info) {
    console.log(`  Server   : MongoDB ${info.version}`);
  }

  // --- What is stored ---
  console.log('\n  Collections');
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  if (collections.length === 0) {
    warn('the database is empty, so the seed has not been run yet');
  }
  for (const n of collections) {
    const count = await db.collection(n).countDocuments();
    console.log(`    ${n.padEnd(26)}${String(count).padStart(7)}`);
  }

  // --- The seed ---
  console.log('\n  Seed data');
  for (const n of SEEDED) {
    const count = collections.includes(n) ? await db.collection(n).countDocuments() : 0;
    if (count === 0) {
      fail(`${n} is empty, run: npm run seed`);
    } else {
      pass(`${n} holds ${count}`);
    }
  }

  // --- The indexes that stop double processing ---
  console.log('\n  Unique indexes');
  for (const [collection, key] of INDEXES_REQUIRED) {
    if (!collections.includes(collection)) {
      warn(`${collection} does not exist yet, so its index cannot be checked`);
      continue;
    }
    const indexes = await db.collection(collection).indexes();
    const found = indexes.find(
      (i) => i.unique && (i.name === key || i.name === `${key}_1` || Object.keys(i.key).join('_') === key),
    );
    if (found) {
      pass(`${collection} is unique on ${Object.keys(found.key).join(' + ')}`);
    } else {
      fail(`${collection} has no unique index for ${key}`);
    }
  }

  // --- Room left ---
  const stats = await db.stats().catch(() => null);
  if (stats) {
    const dataMb = stats.dataSize / 1048576;
    const indexMb = stats.indexSize / 1048576;
    console.log('\n  Size');
    console.log(`    data ${dataMb.toFixed(1)} MB, indexes ${indexMb.toFixed(1)} MB`);
    if (dataMb + indexMb > 400) {
      warn('this is getting close to the 512 MB a free cloud cluster allows');
    }
  }

  await client.close();

  console.log('');
  console.log('='.repeat(72));
  console.log(failed === 0 ? `DATABASE IS READY, ${warned} NOTES` : `${failed} PROBLEMS, ${warned} NOTES`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Check failed:', e.message);
  process.exit(1);
});
