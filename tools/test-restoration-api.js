/**
 * Checks the standalone photo restoration flow.
 *
 * Restoring a photograph used to be something you could only do from inside a
 * pet profile, after supplying six named angles. It now stands on its own: one
 * photograph goes in, a cleaned up one comes back, and only then is there a
 * choice about whether it joins a profile at all.
 *
 * Run: node tools/test-restoration-api.js
 */
const sharp = require('sharp');

const API = process.env.PETMORY_API ?? 'http://localhost:3000/api';
const STAMP = Date.now();
const EMAIL = `phuchoi.${STAMP}@petmory.local`;
const PASSWORD = 'Password@123';

let failed = 0;
function ok(name, passed, note = '') {
  if (!passed) {
    failed += 1;
  }
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '}${name}${note ? '  ' + note : ''}`);
}

/** A picture with some detail in it, so restoring has something to work on. */
async function makePhoto(side = 900) {
  const dots = [];
  for (let i = 0; i < 40; i += 1) {
    dots.push(
      `<circle cx="${(i * 37) % side}" cy="${(i * 53) % side}" r="${8 + (i % 17)}" ` +
        `fill="rgb(${(i * 13) % 255},${(i * 29) % 255},${(i * 7) % 255})" />`,
    );
  }
  return sharp(
    Buffer.from(
      `<svg width="${side}" height="${side}"><rect width="${side}" height="${side}" ` +
        `fill="#caa externally"/>${dots.join('')}</svg>`.replace('#caa externally', '#c8a978'),
    ),
  )
    .png()
    .toBuffer();
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function run() {
  console.log('STANDALONE PHOTO RESTORATION');
  console.log('='.repeat(64));

  const signUp = await call('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, fullName: 'Nguoi phuc hoi' }),
  });
  if (signUp.status !== 201) {
    console.log(`  Cannot register: ${signUp.status}`);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${signUp.body.accessToken}` };

  // --- Restoring with no pet at all ---
  const form = new FormData();
  form.append('file', new Blob([await makePhoto()], { type: 'image/png' }), 'be-cua-toi.png');
  form.append('operation[]', 'SHARPEN');
  form.append('operation[]', 'EXPOSURE');
  const sent = await fetch(`${API}/pet-photos/restoration`, {
    method: 'POST',
    headers: { Authorization: auth.Authorization },
    body: form,
  });
  const made = await sent.json().catch(() => null);
  ok('Phuc hoi duoc ma khong can chon ho so thu cung nao', sent.status === 201, String(sent.status));
  if (sent.status !== 201) {
    console.log('   ', JSON.stringify(made).slice(0, 200));
    process.exit(1);
  }

  ok('Tra ve ca ban goc lan ban da phuc hoi',
    Boolean(made.original?._id) && Boolean(made.restored?._id));
  ok('Ca hai deu chua thuoc ve ho so nao',
    made.original.pet === null && made.restored.pet === null,
    `${made.original.pet} / ${made.restored.pet}`);
  ok('Khong con doi hoi goc chup cu the',
    made.original.angle === 'GENERAL', String(made.original.angle));
  ok('Ban phuc hoi co diem giong ban goc',
    typeof made.restored.resemblance === 'number', String(made.restored.resemblance));

  // --- The loose list ---
  const loose = await call('/pet-photos/restoration', { headers: auth });
  ok('Anh chua gan hien trong danh sach rieng',
    loose.body.some((r) => r._id === made.restored._id), `${loose.body.length} anh`);

  // --- Downloading it ---
  const file = await fetch(`${API}/pet-photos/${made.restored._id}/content`, { headers: auth });
  ok('Tai ve duoc ban da phuc hoi',
    file.ok && (file.headers.get('content-type') ?? '').startsWith('image/'),
    file.headers.get('content-type') ?? String(file.status));

  // --- Attaching it to a pet afterwards ---
  const pet = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: `Be ${STAMP}`, kind: 'CAT' }),
  });
  ok('Tao duoc ho so thu cung voi loai chon tu danh sach', pet.status === 201, String(pet.status));

  const joined = await call(`/pet-photos/${made.restored._id}/attach`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ pet: pet.body._id }),
  });
  ok('Gan anh da phuc hoi vao ho so', joined.status === 201, String(joined.status));
  ok('Anh gio thuoc ve dung ho so do',
    joined.body.pet === pet.body._id, String(joined.body.pet));

  const ofPet = await call(`/pet-photos?pet=${pet.body._id}`, { headers: auth });
  ok('Anh xuat hien trong danh sach anh cua be',
    Array.isArray(ofPet.body) && ofPet.body.some((r) => r._id === made.restored._id),
    `${Array.isArray(ofPet.body) ? ofPet.body.length : 0} anh`);

  const looseAfter = await call('/pet-photos/restoration', { headers: auth });
  ok('Va khong con nam trong danh sach chua gan',
    !looseAfter.body.some((r) => r._id === made.restored._id),
    `${looseAfter.body.length} con lai`);

  const twice = await call(`/pet-photos/${made.restored._id}/attach`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ pet: pet.body._id }),
  });
  ok('Gan lan hai bi tu choi', twice.status === 400, String(twice.status));

  // --- The date rules on a pet ---
  const noDate = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Thieu ngay', kind: 'DOG', status: 'PASSED_AWAY' }),
  });
  ok('Trang thai da roi xa ma thieu ngay thi bi chan', noDate.status === 400, String(noDate.status));

  const backwards = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'Ngay nguoc',
      kind: 'DOG',
      status: 'PASSED_AWAY',
      birthDate: '2020-05-01',
      passedAwayDate: '2019-01-01',
    }),
  });
  ok('Ngay roi xa truoc ngay sinh thi bi chan', backwards.status === 400, String(backwards.status));

  const proper = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'Ho so day du',
      kind: 'RABBIT',
      status: 'PASSED_AWAY',
      birthDate: '2018-03-12',
      passedAwayDate: '2025-11-02',
    }),
  });
  ok('Du ngay sinh va ngay roi xa thi tao duoc', proper.status === 201, String(proper.status));

  const badKind = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Loai la', kind: 'KHUNG LONG' }),
  });
  ok('Loai ngoai danh sach bi tu choi', badKind.status === 400, String(badKind.status));

  console.log('-'.repeat(64));
  console.log(failed === 0 ? 'TAT CA CAC MUC DEU PASS' : `${failed} MUC HONG`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Run failed:', e.message);
  process.exit(1);
});
