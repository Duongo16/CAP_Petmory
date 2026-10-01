/**
 * Checks the 3D models against what the customiser expects.
 *
 * Reads every model file listed in the library manifest and reports, per file:
 * whether it is there at all, which colouring zones it carries, whether the
 * accessory anchor points are present, and how big it is once loaded. The point
 * is that whoever builds a model in Blender gets a pass or fail answer here
 * instead of finding out when the screen renders wrongly.
 *
 * Run: node tools/check-models.js
 */
const fs = require('fs');
const nodePath = require('path');

const MODEL_DIR = nodePath.join(__dirname, '..', 'apps', 'web', 'public', 'models');
const MANIFEST = nodePath.join(MODEL_DIR, 'manifest.json');

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

/** Anchor points a model needs before an accessory can be hung on it. */
const ANCHORS_EXPECTED = ['ANCHOR_NECK', 'ANCHOR_HEAD', 'ANCHOR_EYES'];

/** Above this the model is heavy enough to hurt on a mid-range phone. */
const VERTEX_BUDGET = 40000;

/** The figure should arrive roughly one unit tall so the camera framing holds. */
const HEIGHT_MIN = 0.2;
const HEIGHT_MAX = 100;

let failed = 0;
let warned = 0;

function readJsonFromGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== MAGIC) {
    throw new Error('Not a valid GLB file');
  }
  let offset = 12;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const kind = buf.readUInt32LE(offset + 4);
    if (kind === JSON_CHUNK) {
      return JSON.parse(buf.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  throw new Error('No JSON chunk found in the file');
}

/** The overall size of the model, taken from the bounds the file already records. */
function measureSize(gltf) {
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
      if (!accessor?.min || !accessor?.max) {
        continue;
      }
      for (let i = 0; i < 3; i += 1) {
        low[i] = Math.min(low[i], accessor.min[i]);
        high[i] = Math.max(high[i], accessor.max[i]);
      }
    }
  }
  if (low[0] === Infinity) {
    return null;
  }
  return { x: high[0] - low[0], y: high[1] - low[1], z: high[2] - low[2] };
}

function countVertices(gltf) {
  return (gltf.meshes ?? []).reduce(
    (total, mesh) =>
      total +
      (mesh.primitives ?? []).reduce(
        (t, p) => t + (gltf.accessors?.[p.attributes?.POSITION]?.count ?? 0),
        0,
      ),
    0,
  );
}

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

/** Checks one model against every rule, printing a line per rule. */
function checkModel(entry, declaredZones, zoneByFile, zoneName) {
  const file = nodePath.join(MODEL_DIR, entry.file);
  console.log(`\n${entry.code}  (${entry.file})`);

  if (!fs.existsSync(file)) {
    if (entry.ready) {
      fail(`the file is missing but the manifest marks it ready`);
    } else {
      warn('not built yet, and the manifest already says so');
    }
    return;
  }

  const gltf = readJsonFromGlb(file);
  const zones = (gltf.materials ?? []).map((m, i) => m.name || `material-${i}`);
  const known = zones.filter((z) => declaredZones.has(z));
  const unknown = zones.filter((z) => !declaredZones.has(z));

  if (zones.length === 1) {
    fail(`one zone only ("${zones[0]}"), so the whole animal can only take a single colour`);
  } else if (known.length === 0) {
    fail(`none of its ${zones.length} zones is declared in the manifest: ${zones.join(', ')}`);
  } else if (unknown.length > 0) {
    warn(`${known.length} of ${zones.length} zones can be coloured; not declared: ${unknown.join(', ')}`);
  } else {
    pass(`${known.length} zones, all declared and colourable: ${known.join(', ')}`);
  }

  /*
   * Kiem lop vung co ten.
   *
   * Hop dong yeu cau moi mo hinh chia dung sau vung co ten. Tep mo hinh dat
   * ten mang vat lieu theo kieu rieng, nen ban do vung trong ban khai la thu
   * noi mang nao thuoc vung nao. Vung nao khong co mang nao tro toi la vung
   * tep chua tach rieng, va do la viec phai lam lai trong Blender.
   */
  const zoneMap = zoneByFile[entry.file] ?? {};
  const covered = new Set(zones.map((one) => zoneMap[one]).filter(Boolean));
  const missingZones = zoneName.filter((one) => !covered.has(one));
  const unmapped = zones.filter((one) => !zoneMap[one]);
  if (missingZones.length === 0) {
    pass(`du ${zoneName.length} vung co ten`);
  } else {
    fail(`thieu ${missingZones.length} vung co ten: ${missingZones.join(', ')}`);
  }
  if (unmapped.length > 0) {
    warn(`chua xep vung cho: ${unmapped.join(', ')}`);
  }

  const nodeNames = new Set((gltf.nodes ?? []).map((n) => n.name).filter(Boolean));
  const missingAnchors = ANCHORS_EXPECTED.filter((a) => !nodeNames.has(a));
  if (missingAnchors.length === 0) {
    pass('every accessory anchor is present');
  } else if (missingAnchors.length === ANCHORS_EXPECTED.length) {
    warn('no accessory anchor yet, so accessories cannot be attached');
  } else {
    warn(`missing anchors: ${missingAnchors.join(', ')}`);
  }

  const vertices = countVertices(gltf);
  if (vertices > VERTEX_BUDGET) {
    warn(`${vertices.toLocaleString('en-US')} vertices, above the ${VERTEX_BUDGET.toLocaleString('en-US')} budget`);
  } else {
    pass(`${vertices.toLocaleString('en-US')} vertices, within budget`);
  }

  const size = measureSize(gltf);
  if (!size) {
    warn('the file records no bounds, so its size cannot be checked');
  } else {
    const tallest = Math.max(size.x, size.y, size.z);
    const shape = `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`;
    if (tallest < HEIGHT_MIN || tallest > HEIGHT_MAX) {
      warn(`size ${shape} is far from the usual range, check the export scale`);
    } else {
      pass(`size ${shape}`);
    }
  }
}

function run() {
  if (!fs.existsSync(MANIFEST)) {
    console.log('No manifest found at', MANIFEST);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const declaredZones = new Set((manifest.zoneMaterial ?? []).map((z) => z.name));
  const zoneByFile = manifest.zoneByFile ?? {};
  const zoneName = manifest.zoneName ?? [];

  console.log('3D MODEL CHECK');
  console.log('='.repeat(72));
  console.log(`Zones the manifest declares: ${[...declaredZones].join(', ')}`);
  console.log(`Sau vung co ten hop dong yeu cau: ${zoneName.join(', ')}`);
  console.log(`Anchors expected on each model: ${ANCHORS_EXPECTED.join(', ')}`);

  for (const entry of manifest.baseModel ?? []) {
    checkModel(entry, declaredZones, zoneByFile, zoneName);
  }

  console.log('');
  console.log('='.repeat(72));
  console.log(failed === 0 ? `NO BLOCKING PROBLEM, ${warned} NOTES` : `${failed} BLOCKING PROBLEMS, ${warned} NOTES`);
  process.exit(failed === 0 ? 0 : 1);
}

run();
