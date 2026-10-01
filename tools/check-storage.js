/**
 * Checks where pictures are kept and that the store really works.
 *
 * The important part is not that an upload succeeds. It is that a community
 * picture comes back to anyone with the address, while a pet picture does not,
 * because the whole ownership check in the API is worthless if the picture
 * service hands the file to anybody who guesses the address.
 *
 * Run: node tools/check-storage.js
 */
const fs = require('fs');
const path = require('path');

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

/** Reads the environment file without pulling in a library. */
function readEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) {
    return {};
  }
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    out[trimmed.slice(0, trimmed.indexOf('=')).trim()] = trimmed
      .slice(trimmed.indexOf('=') + 1)
      .trim();
  }
  return out;
}

/** The smallest valid picture, so nothing meaningful is uploaded. */
function tinyPicture() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

async function run() {
  console.log('PICTURE STORE CHECK');
  console.log('='.repeat(72));

  const env = { ...readEnv(), ...process.env };
  const driver = env.STORAGE_DRIVER || 'disk';
  console.log(`  Store    : ${driver}`);

  if (driver !== 'cloudinary') {
    console.log('');
    warn('pictures are kept on the disk of this machine, so nothing to reach');
    warn('set STORAGE_DRIVER to cloudinary in .env to check the picture service');
    console.log('');
    console.log('='.repeat(72));
    console.log(`STORE IS THE LOCAL DISK, ${warned} NOTES`);
    process.exit(0);
  }

  for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!env[name]) {
      fail(`${name} is missing from .env`);
    }
  }
  if (failed > 0) {
    console.log('');
    console.log('='.repeat(72));
    console.log('CREDENTIALS ARE INCOMPLETE');
    process.exit(1);
  }

  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log(`  Account  : ${env.CLOUDINARY_CLOUD_NAME}`);

  // --- Does the account answer at all ---
  const started = Date.now();
  try {
    await cloudinary.api.ping();
    pass(`the account answers, in ${Date.now() - started} ms`);
  } catch (error) {
    fail(`the account does not answer: ${error.message || error}`);
    console.log('');
    console.log('='.repeat(72));
    console.log('CANNOT REACH THE PICTURE SERVICE');
    process.exit(1);
  }

  // --- How much room is left ---
  try {
    const usage = await cloudinary.api.usage();
    const credits = usage.credits || {};
    console.log(
      `  Room     : ${(credits.usage ?? 0).toFixed(2)} of ${credits.limit ?? '?'} credits used`,
    );
    if (credits.used_percent && credits.used_percent > 80) {
      warn('over four fifths of the monthly allowance is gone');
    }
  } catch {
    warn('could not read the monthly allowance');
  }

  const stamp = Date.now();
  const picture = tinyPicture();
  const written = [];

  /** Uploads one test file and hands back what is needed to check it. */
  async function put(folder, delivery) {
    // Duoi tep de rieng, giong het cach ben trong may chu lam.
    const id = `petmory/${folder}/kiem-tra-${stamp}`;
    await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: id,
          format: 'png',
          resource_type: 'image',
          type: delivery,
          overwrite: true,
        },
        (error) => (error ? reject(new Error(error.message)) : resolve()),
      );
      stream.end(picture);
    });
    written.push({ id, delivery });
    return id;
  }

  console.log('\n  Community pictures, which anyone may see');
  try {
    const id = await put('community', 'upload');
    pass('a community picture uploads');
    const address = cloudinary.url(id, { type: 'upload', secure: true, format: 'png', force_version: false });
    const answer = await fetch(address);
    if (answer.ok) {
      pass('and comes back to anyone with the address, as a public post should');
    } else {
      fail(`but cannot be read back: ${answer.status}`);
    }
  } catch (error) {
    fail(`a community picture will not upload: ${error.message}`);
  }

  console.log('\n  Pet pictures, which belong to one customer');
  try {
    const id = await put('pets', 'authenticated');
    pass('a pet picture uploads');

    // The plain address is what a stranger would try first.
    const plain = cloudinary.url(id, { type: 'authenticated', secure: true, format: 'png', force_version: false });
    const guessed = await fetch(plain);
    if (guessed.ok) {
      fail('a stranger guessing the address can see it, which breaks the owner check');
    } else {
      pass(`a guessed address is refused (${guessed.status}), so the owner check still holds`);
    }

    // The signed address is what the API hands out after checking ownership.
    const signed = cloudinary.url(id, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      format: 'png',
      force_version: false,
      expires_at: Math.floor(Date.now() / 1000) + 600,
    });
    const allowed = await fetch(signed);
    if (allowed.ok) {
      pass('a signed address works, so the owner can still see their own picture');
    } else {
      fail(`a signed address does not work either: ${allowed.status}`);
    }

    // An expiry was asked for on this address. Whether the service honours it
    // decides what the API is allowed to hand to a browser, so it is measured
    // rather than assumed.
    const stale = cloudinary.url(id, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      format: 'png',
      force_version: false,
      expires_at: Math.floor(Date.now() / 1000) - 60,
    });
    const expired = await fetch(stale);
    if (!expired.ok && allowed.ok) {
      pass(`an address built to have run out is refused (${expired.status})`);
    } else if (allowed.ok) {
      warn('this plan does not enforce an expiry, so a signed address never stops working');
      warn('that is why the API sends the bytes itself instead of giving out the address');
    } else {
      fail('cannot tell whether an expiry matters, since no address worked at all');
    }
  } catch (error) {
    fail(`a pet picture will not upload: ${error.message}`);
  }

  // --- What the API itself is willing to give out ---
  console.log('\n  What the API hands to a browser');
  const built = path.join(__dirname, '..', 'apps', 'api', 'dist', 'common', 'storage');
  if (fs.existsSync(path.join(built, 'cloudinary-storage.js'))) {
    const { CloudinaryStorage } = require(path.join(built, 'cloudinary-storage.js'));
    const settings = {
      'storage.cloudinary.cloudName': env.CLOUDINARY_CLOUD_NAME,
      'storage.cloudinary.apiKey': env.CLOUDINARY_API_KEY,
      'storage.cloudinary.apiSecret': env.CLOUDINARY_API_SECRET,
    };
    const store = new CloudinaryStorage({
      getOrThrow: (key) => settings[key],
      get: (key) => settings[key],
    });
    const forPet = store.addressOf('pets', 'vi-du.png');
    const forDesign = store.addressOf('designs', 'vi-du.png');
    const forPost = store.addressOf('community', 'vi-du.png');
    if (forPet === null && forDesign === null) {
      pass('no address is given out for a pet picture or a design preview');
    } else {
      fail('an address is given out for a private picture, which is a permanent key');
    }
    if (typeof forPost === 'string' && forPost.includes('/image/upload/')) {
      pass('a community picture does get a plain address, so the network can serve it');
    } else {
      fail(`a community picture has no usable address: ${forPost}`);
    }
  } else {
    warn('the API has not been built, so what it hands out could not be checked');
    warn('run: npm run build --workspace apps/api');
  }

  // --- Tidy up, so a check leaves nothing behind ---
  console.log('\n  Tidying up');
  for (const { id, delivery } of written) {
    try {
      await cloudinary.uploader.destroy(id, { resource_type: 'image', type: delivery });
    } catch {
      warn(`could not remove the test file ${id}`);
    }
  }
  pass(`${written.length} test files removed`);

  console.log('');
  console.log('='.repeat(72));
  console.log(
    failed === 0 ? `PICTURE STORE IS READY, ${warned} NOTES` : `${failed} PROBLEMS, ${warned} NOTES`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Check failed:', e.message);
  process.exit(1);
});
