/**
 * Day cac anh minh hoa da dung lai len dich vu anh.
 *
 * Anh cua danh muc san pham khong lay tu thu muc trong du an ma lay tu dich vu
 * anh tren mang. Doi bang mau ma chi dung lai tep trong du an thi the san pham
 * van giu nen cua bo nhan dien cu, nen buoc nay ghi de len dung ma cu tren
 * dich vu do.
 *
 * Khoa dich vu doc tu bien moi truong, khong nam trong ma nguon.
 *
 * Chay: node tools/push-demo-images.js          xem se day nhung gi
 *       node tools/push-demo-images.js --thuc   day that
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FOLDER = path.join(ROOT, 'apps', 'web', 'public', 'demo');

/** Thu muc tren dich vu anh, dung voi dia chi cac ban ghi dang tro toi. */
const REMOTE = 'petmory/demo';

/** Doc mot bien trong tep cau hinh, khong ghi gia tri ra man hinh. */
function fromEnv(name) {
  if (process.env[name]) {
    return process.env[name];
  }
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) {
    return '';
  }
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((one) => one.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim() : '';
}

/**
 * Chu ky cua mot lan goi.
 *
 * Dich vu doi cac tham so duoc xep theo thu tu chu cai, noi lai roi bam cung
 * voi khoa bi mat. Khoa chi tham gia vao phep bam, khong bao gio duoc gui di.
 */
function signature(params, secret) {
  const text = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(text + secret).digest('hex');
}

async function pushOne(file, cloudName, apiKey, secret) {
  const name = path.basename(file, path.extname(file));
  const stamp = Math.floor(Date.now() / 1000);
  const params = {
    invalidate: 'true',
    overwrite: 'true',
    public_id: `${REMOTE}/${name}`,
    timestamp: String(stamp),
  };

  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('api_key', apiKey);
  form.append('timestamp', params.timestamp);
  form.append('public_id', params.public_id);
  form.append('overwrite', params.overwrite);
  form.append('invalidate', params.invalidate);
  form.append('signature', signature(params, secret));

  const answer = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await answer.json();
  return { ok: answer.ok, name, version: body.version ?? null, why: body.error?.message ?? '' };
}

async function run() {
  const real = process.argv.includes('--thuc');
  const cloudName = fromEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = fromEnv('CLOUDINARY_API_KEY');
  const secret = fromEnv('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !secret) {
    console.log('Thieu cau hinh dich vu anh. Khong day duoc.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(FOLDER)
    .filter((one) => one.endsWith('.png'))
    .map((one) => path.join(FOLDER, one));

  console.log('DAY ANH MINH HOA LEN DICH VU ANH');
  console.log('='.repeat(62));
  console.log(`Kho anh: ${cloudName} · thu muc ${REMOTE}`);
  console.log(`${files.length} tep`);
  console.log('');

  if (!real) {
    for (const file of files) {
      console.log(`  se day  ${path.basename(file)}`);
    }
    console.log('');
    console.log('Chay lai kem --thuc de day that.');
    return;
  }

  let failed = 0;
  for (const file of files) {
    const got = await pushOne(file, cloudName, apiKey, secret);
    if (got.ok) {
      console.log(`  xong    ${got.name}  ban ${got.version}`);
    } else {
      failed += 1;
      console.log(`  HONG    ${got.name}  ${got.why}`);
    }
  }

  console.log('-'.repeat(62));
  console.log(failed === 0 ? 'Da day het' : `${failed} tep khong day duoc`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
