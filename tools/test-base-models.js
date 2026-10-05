/**
 * Kiem thu vien mau nen theo SOW muc 6: bon mau (cho ngoi, cho dung, meo ngoi,
 * meo nam), moi mau du sau vung vat lieu, du bon diem neo phu kien, co ban nhe
 * va ban day du; sau phu kien doc duoc; may chu tu choi mau ngoai thu vien.
 * Doc thang phan JSON trong tep GLB, khong can trinh duyet.
 * Run: node tools/test-base-models.js
 */
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3000/api';
const DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'models');
const ZONES = ['PM_FUR_MAIN', 'PM_FUR_SECONDARY', 'PM_EARS', 'PM_TAIL', 'PM_EYES', 'PM_NOSE'];
const ANCHORS = ['PM_ANCHOR_HEAD', 'PM_ANCHOR_FACE', 'PM_ANCHOR_NECK', 'PM_ANCHOR_BACK'];
/** Ban nhe phai du nhe de dien thoai xoay muot. */
const LITE_VERTEX_MAX = 15000;

function check(name, passed, note = '') {
  console.log(`  ${passed ? 'PASS  ' : 'FAIL  '} ${name}${note ? '  ' + note : ''}`);
  return passed;
}

/** Phan JSON cua mot tep GLB: tieu de 12 byte, roi khuc JSON dau tien. */
function readGlb(file) {
  const raw = fs.readFileSync(path.join(DIR, file));
  const length = raw.readUInt32LE(12);
  return JSON.parse(raw.subarray(20, 20 + length).toString('utf8'));
}

function vertexCount(gltf) {
  let total = 0;
  for (const mesh of gltf.meshes ?? []) {
    for (const part of mesh.primitives) {
      total += gltf.accessors[part.attributes.POSITION].count;
    }
  }
  return total;
}

async function run() {
  const res = [];
  console.log('BASE MODEL LIBRARY TEST');
  console.log('='.repeat(64));
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const core = manifest.baseModel.filter((one) => one.core);
  const shape = core.map((one) => `${one.kind}-${one.pose}`).sort().join(',');
  res.push(check('The library declares the four contract poses',
    shape === 'CAT-LYING,CAT-SITTING,DOG-SITTING,DOG-STANDING', shape));

  for (const one of core) {
    const lite = readGlb(one.file);
    const full = readGlb(one.fileFull);
    const names = new Set((lite.materials ?? []).map((m) => m.name));
    const missing = ZONES.filter((zone) => !names.has(zone));
    res.push(check(`${one.code}: six material zones`, missing.length === 0 && names.size === 6, missing.join(',')));
    const nodes = new Set((lite.nodes ?? []).map((n) => n.name));
    const noAnchor = ANCHORS.filter((a) => !nodes.has(a));
    res.push(check(`${one.code}: four accessory anchors`, noAnchor.length === 0, noAnchor.join(',')));
    const fullNodes = new Set((full.nodes ?? []).map((n) => n.name));
    res.push(check(`${one.code}: full version keeps zones and anchors`,
      ZONES.every((z) => (full.materials ?? []).some((m) => m.name === z)) && ANCHORS.every((a) => fullNodes.has(a))));
    const liteCount = vertexCount(lite);
    const fullCount = vertexCount(full);
    res.push(check(`${one.code}: light version is light, full version is finer`,
      liteCount <= LITE_VERTEX_MAX && fullCount > liteCount * 3, `${liteCount} / ${fullCount}`));
  }

  const accessories = fs.readdirSync(DIR).filter((name) => name.startsWith('acc-') && name.endsWith('.glb'));
  res.push(check('About six shared accessories are delivered', accessories.length === 6, String(accessories.length)));
  res.push(check('Every accessory file parses',
    accessories.every((name) => (readGlb(name).meshes ?? []).length > 0)));

  const login = await (await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `models.${Date.now()}@petmory.local`, password: 'Password@123', fullName: 'Models test' }),
  })).json();
  const refused = await fetch(`${API}/designs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${login.accessToken}` },
    body: JSON.stringify({ name: 'Mau la', modelCode: 'KHONG-CO-MAU-NAY' }),
  });
  res.push(check('The server refuses a design on a model outside the library', refused.status === 400, String(refused.status)));

  console.log('='.repeat(64));
  const failed = res.filter((x) => !x).length;
  console.log(failed === 0 ? `ALL ${res.length} CHECKS PASSED` : `${failed}/${res.length} CHECKS FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('Test error:', e.message.slice(0, 300));
  process.exit(1);
});
