/**
 * Tests photo upload, quality scoring, photo restoration and the conversational assistant.
 * Sample images are generated on the fly, so no external file is needed.
 * Run: node tools/test-photos-assistant.js
 */
const sharp = require('sharp');

const API = 'http://localhost:3000/api';
let passed = 0;
let failed = 0;

function check(name, ok, note = '') {
  console.log(`  ${ok ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  ok ? (passed += 1) : (failed += 1);
}

async function call(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/** A sharp image: many small squares of strong contrast. */
async function sharpImage(edge = 1400) {
  const o = 40;
  const svg = [`<svg width="${edge}" height="${edge}">`];
  for (let y = 0; y < edge; y += o) {
    for (let x = 0; x < edge; x += o) {
      const shade = ((x / o + y / o) % 2 === 0) ? '#202020' : '#e8e8e8';
      svg.push(`<rect x="${x}" y="${y}" width="${o}" height="${o}" fill="${shade}"/>`);
    }
  }
  svg.push('</svg>');
  return sharp(Buffer.from(svg.join(''))).png().toBuffer();
}

/** A blurred, small image: heavily smeared and then scaled down. */
async function photoOpen(edge = 380) {
  const angle = await sharpImage(edge);
  return sharp(angle).blur(9).png().toBuffer();
}

/**
 * An image with dense texture, like animal fur. Used to test sharpness, because a flat
 * single-colour image cannot show the difference between sharp and blurred.
 */
async function texturedImage(edge) {
  const should = await sharpImage(edge);
  const many = await sharp({
    create: { width: edge, height: edge, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 26 } },
  }).png().toBuffer();
  return sharp(should).composite([{ input: many, blend: 'overlay' }]).png().toBuffer();
}

async function upload(token, pet, angle, data, name) {
  const form = new FormData();
  form.append('angle', angle);
  form.append('file', new Blob([data], { type: 'image/png' }), name);
  const res = await fetch(`${API}/pet-photos/${pet}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function run() {
  console.log('PHOTO UPLOAD, RESTORATION AND ASSISTANT TEST');
  console.log('='.repeat(66));

  const email = `photo.${Date.now()}@petmory.local`;
  const dk = await call('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password@123', fullName: 'Photo test' }),
  });
  const token = dk.body.accessToken;
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const pet = await call('/pets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Milo', kind: 'DOG', breed: 'Corgi' }),
  });
  const petId = pet.body._id;
  check('Create a pet profile', pet.status === 201);

        // --- Upload a good photo ---
  const good = await upload(token, petId, 'FRONT', await sharpImage(), 'sharp.png');
  check('Upload a sharp photo', good.status === 201);
  check('A sharp photo is scored GOOD', good.body?.quality?.label === 'GOOD', good.body?.quality?.label);
  check('The image dimensions are read', good.body?.quality?.shortEdge === 1400, `${good.body?.quality?.shortEdge}px`);

        // --- Upload a blurred photo ---
  const open = await upload(token, petId, 'LEFT_SIDE', await photoOpen(), 'blurred.png');
  check('Upload a blurred photo', open.status === 201);
  const labelOpen = open.body?.quality?.label;
  check('A small blurred photo is recognised', labelOpen === 'SHOULD_RESTORE' || labelOpen === 'UNUSABLE', labelOpen);
  check('A warning is raised for a blurred photo', (open.body?.quality?.warning ?? []).length > 0,
    (open.body?.quality?.warning ?? []).join(','));

        // --- Sharpness must tell sharp from blurred at the same resolution ---
        // This is the measurement that matters most: if two images of the same size score
        // about the same, the measurement says nothing at all.
  const sharpTexture = await texturedImage(1200);
  const blurredTexture = await sharp(sharpTexture).blur(4).png().toBuffer();
  const sharpUpload = await upload(token, petId, 'RIGHT_SIDE', sharpTexture, 'texture-sharp.png');
  const blurredUpload = await upload(token, petId, 'FACE_CLOSEUP', blurredTexture, 'texture-blurred.png');
  const sharpnessOfSharp = sharpUpload.body?.quality?.sharpness ?? 0;
  const sharpnessOfBlurred = blurredUpload.body?.quality?.sharpness ?? 0;
  check('Sharpness tells sharp from blurred at the same 1200px', sharpnessOfSharp > sharpnessOfBlurred * 10, `${sharpnessOfSharp} against ${sharpnessOfBlurred}`);
  check('A sharp 1200px photo is scored GOOD', sharpUpload.body?.quality?.label === 'GOOD', sharpUpload.body?.quality?.label);
  check('A blurred 1200px photo is flagged as blurred',
    (blurredUpload.body?.quality?.warning ?? []).includes('TOO_BLURRY'),
    (blurredUpload.body?.quality?.warning ?? []).join(','));

        // --- Brightening pulls exposure towards a comfortable level ---
  const darkImage = await sharp(await texturedImage(1200)).linear(0.42, -6).png().toBuffer();
  const darkUpload = await upload(token, petId, 'FAVOURITE_POSE', darkImage, 'dark.png');
  check('An underexposed photo is caught',
    (darkUpload.body?.quality?.warning ?? []).includes('UNDEREXPOSED'),
    `brightness ${darkUpload.body?.quality?.brightness}`);
  const brightened = await call(`/pet-photos/${darkUpload.body._id}/restore`, {
    method: 'POST', headers: auth, body: JSON.stringify({ operation: ['EXPOSURE'] }),
  });
  check('Brightening lifts a dark photo',
    brightened.body?.quality?.brightness > darkUpload.body?.quality?.brightness + 20,
    `${darkUpload.body?.quality?.brightness} -> ${brightened.body?.quality?.brightness}`);

        // --- Reject a file that is not an image ---
  const badForm = new FormData();
  badForm.append('angle', 'BACK');
  badForm.append('file', new Blob([Buffer.from('this is not an image')], { type: 'video/mp4' }), 'clip.mp4');
  const badUpload = await fetch(`${API}/pet-photos/${petId}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: badForm,
  });
  check('Rejects a file that is not an image', badUpload.status === 400);

        // --- Check the required angles ---
  const angle = await call(`/pet-photos/check-angles?pet=${petId}`, { headers: auth });
  check('Reports the required angles still missing',
    angle.body.rawAngle === false && angle.body.missing.join(',') === 'BACK',
    `thieu ${angle.body.missing.join(', ')}`);

        // --- Restore a blurred photo ---
  const codePhotoOpen = open.body._id;
  const photo = await call(`/pet-photos/${codePhotoOpen}/restore`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ operation: ['UPSCALE', 'SHARPEN', 'DENOISE', 'EXPOSURE'] }),
  });
  check('Restore a blurred photo', photo.status === 201);
  check('The restored version points back at the original', photo.body?.originalPhoto === codePhotoOpen);
  check('The restored version is not confirmed yet', photo.body?.confirmedByOwner === false);
  check('Upscaling raises the resolution',
    photo.body?.quality?.shortEdge > open.body?.quality?.shortEdge,
    `${open.body?.quality?.shortEdge} -> ${photo.body?.quality?.shortEdge}`);
  check('Sharpening raises the sharpness',
    photo.body?.quality?.sharpness > open.body?.quality?.sharpness,
    `${open.body?.quality?.sharpness} -> ${photo.body?.quality?.sharpness}`);

        // --- The original is left untouched ---
  const listAfter = await call(`/pet-photos?pet=${petId}`, { headers: auth });
  const remainingAngle = listAfter.body.find((a) => a._id === codePhotoOpen);
  check('The original is left untouched', Boolean(remainingAngle) && remainingAngle.isRestored === false);

        // --- A restored version cannot itself be restored ---
  const restoreAgain = await call(`/pet-photos/${photo.body._id}/restore`, {
    method: 'POST', headers: auth, body: JSON.stringify({ operation: ['SHARPEN'] }),
  });
  check('Rejects restoring from an already restored version', restoreAgain.status === 400);

        // --- Confirmation ---
  const confirm = await call(`/pet-photos/${photo.body._id}/confirm`, {
    method: 'POST', headers: auth, body: JSON.stringify({ accept: true }),
  });
  check('Confirmation applies to the restored version', confirm.body?.confirmedByOwner === true);

        // --- Ownership ---
  const dk2 = await call('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `k.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Nguoi khac' }),
  });
  const steal = await call(`/pet-photos/${codePhotoOpen}/content`, {
    headers: { Authorization: `Bearer ${dk2.body.accessToken}` },
  });
  check('Another user cannot view the photo', steal.status === 404);

  const notLogin = await call(`/pet-photos/${codePhotoOpen}/content`);
  check('Signed out requests cannot view the photo', notLogin.status === 401);

        // --- The restoration quota passed by the Manager group ---
  const managerLogin = await call('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'quanly@petmory.local', password: 'Petmory@2026' }),
  });
  const managerAuth = { Authorization: `Bearer ${managerLogin.body.accessToken}`, 'Content-Type': 'application/json' };
  const cfBefore = await call('/settings', { headers: managerAuth });
  const quotaOld = cfBefore.body.aiQuota;

  await call('/settings', {
    method: 'PATCH', headers: managerAuth,
    body: JSON.stringify({ aiQuota: { restorePhoto: { day: 1, month: 300, year: 3000 } } }),
  });

        // A new user who has never restored anything must be allowed the first one
  const dk3 = await call('/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `hm.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Quota' }),
  });
  const tok3 = dk3.body.accessToken;
  const auth3 = { Authorization: `Bearer ${tok3}`, 'Content-Type': 'application/json' };
  const pet3 = await call('/pets', {
    method: 'POST', headers: auth3,
    body: JSON.stringify({ name: 'Bin', kind: 'CAT' }),
  });
  const a1 = await upload(tok3, pet3.body._id, 'FRONT', await photoOpen(), 'frame-1.png');
  const a2 = await upload(tok3, pet3.body._id, 'LEFT_SIDE', await photoOpen(), 'frame-2.png');
  const ph1 = await call(`/pet-photos/${a1.body._id}/restore`, {
    method: 'POST', headers: auth3, body: JSON.stringify({ operation: ['SHARPEN'] }),
  });
  check('Within quota a restoration is allowed', ph1.status === 201, String(ph1.status));
  const ph2 = await call(`/pet-photos/${a2.body._id}/restore`, {
    method: 'POST', headers: auth3, body: JSON.stringify({ operation: ['SHARPEN'] }),
  });
  check('Over quota it is rejected', ph2.status === 429, String(ph2.status));

  await call('/settings', {
    method: 'PATCH', headers: managerAuth, body: JSON.stringify({ aiQuota: quotaOld }),
  });
  const cfAfter = await call('/settings', { headers: managerAuth });
  check('Puts the quota back as it was',
    cfAfter.body.aiQuota.restorePhoto.day === quotaOld.restorePhoto.day,
    `per day = ${cfAfter.body.aiQuota.restorePhoto.day}`);

        // --- Conversational assistant ---
  console.log('');
  console.log('  --- Conversational assistant ---');
  const question = [
    ['giá bao nhiêu tiền vậy shop', 'PRICE'],
    ['làm mất bao lâu thì nhận được', 'LEAD_TIME'],
    ['có những kích cỡ nào', 'SIZES'],
    ['làm bằng chất liệu gì', 'MATERIAL'],
    ['đặt hàng như thế nào', 'PROCESS'],
    ['bé nhà mình đã mất rồi', 'MEMORIAL'],
    ['chó nhà mình bị ốm uống thuốc gì', 'VET'],
    ['shop có bán thức ăn cho chó không', 'MERCHANDISE'],
    ['thanh toán bằng cách nào', 'PAYMENT'],
  ];
  for (const [text, expectedCode] of question) {
    const tl = await call('/assistant/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text }),
    });
    check(`Understands "${text.slice(0, 32)}"`, tl.body?.code === expectedCode, tl.body?.code);
  }

  const priceAnswer = await call('/assistant/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'giá bao nhiêu' }),
  });
  check('The price answer comes from real data', priceAnswer.body.content.includes('450.000'),
    priceAnswer.body.content.split('\n')[1]?.slice(0, 40));

  const offTopic = await call('/assistant/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'xyzabc khong lien quan gi ca' }),
  });
  check('Reports not understanding an off-topic question', offTopic.body?.understood === false);

  console.log('='.repeat(66));
  console.log(failed === 0 ? `ALL ${passed} CHECKS PASSED` : `${failed}/${passed + failed} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message);
  process.exit(1);
});
