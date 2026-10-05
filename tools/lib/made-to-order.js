/**
 * Chuan bi mot dong hang tuy bien hop le cho bai kiem thu (SOW muc 7): mot be,
 * du so anh toi thieu cua kich co, mot ban thiet ke gan be va kich co, roi them
 * vao gio. May chu tu choi dong tuy bien thieu mot trong cac thu do.
 */
const sharp = require('sharp');

const API = process.env.API_URL || 'http://localhost:3000/api';

/** So anh toi thieu cua tung kich co, doc thang tu danh muc. */
async function minPhotosOf(productTypeCode, sizeCode) {
  const kind = await (await fetch(`${API}/catalog/products/${productTypeCode}`)).json();
  const size = (kind.sizes ?? []).find((one) => one.code === sizeCode);
  return size?.minPhotos ?? 4;
}

/** Mot tam anh du lon va du net de qua buoc cham chat luong; moi tam mot hoa tiet. */
async function samplePhoto(seed) {
  const width = 1200;
  const height = 900;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) {
    raw[i] = (i * (29 + seed) + (i >> 5) * 13) % 255;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
}

async function asJson(res) {
  return res.json().catch(() => ({}));
}

/** Tao mot be va tai len so anh chi dinh; tra ve ma be. */
async function petWithPhotos(token, count = 4, petName = 'Be thu') {
  const auth = { Authorization: `Bearer ${token}` };
  const pet = await asJson(await fetch(`${API}/pets`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ name: petName }),
  }));
  for (let at = 0; at < count; at += 1) {
    const form = new FormData();
    form.append('file', new Blob([await samplePhoto(at)], { type: 'image/jpeg' }), `anh-${at}.jpg`);
    const sent = await fetch(`${API}/pet-photos/${pet._id}`, { method: 'POST', headers: auth, body: form });
    if (!sent.ok) {
      throw new Error(`tai anh that bai: ${sent.status}`);
    }
  }
  return pet._id;
}

/** Tai bu anh cho mot be co san den khi du so anh can. */
async function ensurePhotos(token, petId, need) {
  const auth = { Authorization: `Bearer ${token}` };
  const rows = await asJson(await fetch(`${API}/pet-photos?pet=${petId}`, { headers: auth }));
  const have = Array.isArray(rows) ? rows.filter((one) => !one.isRestored).length : 0;
  for (let at = have; at < need; at += 1) {
    const form = new FormData();
    form.append('file', new Blob([await samplePhoto(at + 7)], { type: 'image/jpeg' }), `bu-${at}.jpg`);
    await fetch(`${API}/pet-photos/${petId}`, { method: 'POST', headers: auth, body: form });
  }
}

/**
 * Tao be, tai anh, tao ban thiet ke. Tra ve ma be va ma ban thiet ke.
 * extra: cac o them cho ban thiet ke (vi du accessories, stand).
 */
async function readyDesign(token, { productTypeCode = 'PT-01', sizeCode = 'FIG-M', petName = 'Be thu', extra = {} } = {}) {
  const auth = { Authorization: `Bearer ${token}` };
  const pet = await asJson(await fetch(`${API}/pets`, {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ name: petName }),
  }));
  const need = await minPhotosOf(productTypeCode, sizeCode);
  for (let at = 0; at < need; at += 1) {
    const form = new FormData();
    form.append('file', new Blob([await samplePhoto(at)], { type: 'image/jpeg' }), `anh-${at}.jpg`);
    const sent = await fetch(`${API}/pet-photos/${pet._id}`, { method: 'POST', headers: auth, body: form });
    if (!sent.ok) {
      throw new Error(`tai anh that bai: ${sent.status}`);
    }
  }
  const design = await asJson(await fetch(`${API}/designs`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Thiet ke ${petName}`, modelCode: 'BASE-DOG-STAND', productTypeCode, sizeCode, pet: pet._id, ...extra }),
  }));
  if (!design._id) {
    throw new Error(`tao ban thiet ke that bai: ${JSON.stringify(design).slice(0, 200)}`);
  }
  return { petId: pet._id, designId: design._id };
}

/** Them mot dong tuy bien hop le vao gio; tra ve phan hoi cua may chu. */
async function addCustomLine(token, { productTypeCode = 'PT-01', sizeCode = 'FIG-M', quantity = 1, displayBaseCode, petName, extra } = {}) {
  const ready = await readyDesign(token, { productTypeCode, sizeCode, petName, extra });
  const res = await fetch(`${API}/cart/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ productTypeCode, sizeCode, quantity, designId: ready.designId, ...(displayBaseCode ? { displayBaseCode } : {}) }),
  });
  return { ...ready, status: res.status, body: await asJson(res) };
}

module.exports = { readyDesign, addCustomLine, samplePhoto, petWithPhotos, ensurePhotos, minPhotosOf };
