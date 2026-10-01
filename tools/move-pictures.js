/**
 * Moves the pictures that records still point at onto the picture service.
 *
 * Only files a live record refers to are moved. The upload folder holds 431 MB,
 * almost all of it left behind by test runs, and copying that up would burn the
 * monthly allowance for nothing. Anything no record mentions is left where it is.
 *
 * Run: node tools/move-pictures.js            to see what would move
 *      node tools/move-pictures.js --apply    to actually move it
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const ROOT = path.join(__dirname, '..');
const UPLOADS = path.join(ROOT, 'apps', 'api', 'uploads');

/** Where each group of pictures lives on disk and on the picture service. */
const GROUPS = [
  {
    name: 'community',
    folder: 'petmory/community',
    delivery: 'upload',
    directory: path.join(UPLOADS, 'community'),
    async namesInUse(db) {
      const rows = await db.collection('community_posts')
        .find({ isHidden: { $ne: true } }).toArray();
      return rows.flatMap((r) => r.photos ?? []);
    },
  },
  {
    name: 'pets',
    folder: 'petmory/pets',
    delivery: 'authenticated',
    directory: UPLOADS,
    async namesInUse(db) {
      const rows = await db.collection('pet_photos')
        .find({ isHidden: { $ne: true } }).toArray();
      return rows.map((r) => r.fileName).filter(Boolean);
    },
  },
  {
    name: 'designs',
    folder: 'petmory/designs',
    delivery: 'authenticated',
    directory: UPLOADS,
    async namesInUse(db) {
      const rows = await db.collection('designs')
        .find({ isHidden: { $ne: true } }).toArray();
      return rows.flatMap((r) => (r.preview ?? []).map((p) => p.fileName)).filter(Boolean);
    },
  },
];

function readEnv() {
  const out = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      out[trimmed.slice(0, trimmed.indexOf('=')).trim()] = trimmed
        .slice(trimmed.indexOf('=') + 1)
        .trim();
    }
  }
  return out;
}

/** The part of the name after the last dot, which the service keeps apart. */
function endingOf(name) {
  const at = name.lastIndexOf('.');
  return at > 0 ? name.slice(at + 1) : 'png';
}

function withoutEnding(name) {
  const at = name.lastIndexOf('.');
  return at > 0 ? name.slice(0, at) : name;
}

async function run() {
  const apply = process.argv.includes('--apply');
  const env = { ...readEnv(), ...process.env };

  console.log('MOVING PICTURES TO THE PICTURE SERVICE');
  console.log('='.repeat(72));
  console.log(`  Mode     : ${apply ? 'moving for real' : 'listing only, nothing is sent'}`);

  if (!env.CLOUDINARY_CLOUD_NAME) {
    console.log('  No picture service is configured, so there is nowhere to move to.');
    process.exit(1);
  }

  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const dbName = (env.MONGODB_URI.split('://')[1].split('/')[1] || '').split('?')[0];
  const db = client.db(dbName);

  let moved = 0;
  let already = 0;
  let missing = 0;
  let bytes = 0;

  for (const group of GROUPS) {
    const names = [...new Set(await group.namesInUse(db))];
    console.log('');
    console.log(`  ${group.name}: ${names.length} pictures records point at`);

    for (const name of names) {
      const onDisk = path.join(group.directory, name);
      const id = `${group.folder}/${withoutEnding(name)}`;

      const there = await cloudinary.api
        .resource(id, { type: group.delivery, resource_type: 'image' })
        .then(() => true)
        .catch(() => false);
      if (there) {
        already += 1;
        continue;
      }
      if (!fs.existsSync(onDisk)) {
        missing += 1;
        console.log(`    MISSING  ${name} is in a record but not on disk either`);
        continue;
      }
      const size = fs.statSync(onDisk).size;
      if (!apply) {
        moved += 1;
        bytes += size;
        console.log(`    WOULD    ${name}  ${(size / 1024).toFixed(0)} KB`);
        continue;
      }
      await cloudinary.uploader.upload(onDisk, {
        public_id: id,
        format: endingOf(name),
        type: group.delivery,
        resource_type: 'image',
        overwrite: false,
      });
      moved += 1;
      bytes += size;
      console.log(`    MOVED    ${name}  ${(size / 1024).toFixed(0)} KB`);
    }
  }

  await client.close();

  console.log('');
  console.log('='.repeat(72));
  console.log(`  ${apply ? 'moved' : 'would move'} : ${moved} pictures, ${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`  already there : ${already}`);
  console.log(`  gone entirely : ${missing}`);
  if (!apply && moved > 0) {
    console.log('');
    console.log('  Nothing was sent. Run again with --apply to move them.');
  }
  process.exit(0);
}

run().catch((e) => {
  console.error('Moving failed:', e.message);
  process.exit(1);
});
