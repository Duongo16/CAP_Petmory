/**
 * Doan xem tung mang vat lieu cua mot mo hinh thuoc vung nao.
 *
 * Hop dong yeu cau moi mo hinh chia dung sau vung co ten: long chu dao, long
 * bung va nguc, tai, duoi, mat, mui. Cac tep mo hinh hien co lai dat ten
 * mang vat lieu theo kieu rieng cua tung tac gia, co tep con dat la
 * "Material.001", nen khong the tra bang ten.
 *
 * O day moi mang duoc doan theo cho no nam tren con vat: mat va mui nam phia
 * truoc va tren cao, tai nam tren dinh dau, duoi nam phia sau, bung nam duoi
 * bung, phan con lai la long chu dao. Ket qua duoc ghi ra man hinh de nguoi
 * doc kiem lai, va ghi vao ban do vung cua ban khai mo hinh khi chay kem
 * --write.
 *
 * Chay: node tools/map-model-zones.js
 *       node tools/map-model-zones.js --write
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MODELS = path.join(ROOT, 'apps', 'web', 'public', 'models');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const MANIFEST = path.join(MODELS, 'manifest.json');

/** Sau vung co ten, dung nhu hop dong ghi. */
const ZONES = ['MAIN_FUR', 'BELLY_FUR', 'EAR', 'TAIL', 'EYE', 'NOSE'];

/** Serves the model files and the three.js build to the page doing the work. */
function serve(pageFor) {
  const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
  let port = 0;
  const server = http.createServer((req, res) => {
    const asked = decodeURIComponent(req.url.split('?')[0]);
    if (asked === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(pageFor(port));
      return;
    }
    let file = null;
    if (asked.startsWith('/three/')) {
      file = path.join(THREE_DIR, asked.slice('/three/'.length));
    } else if (asked.startsWith('/models/')) {
      file = path.join(MODELS, asked.slice('/models/'.length));
    }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('no');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve({ server, port });
    });
  });
}

/** Trang doc mo hinh va do vi tri cua tung mang vat lieu. */
function pageSource(port, files) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">
{"imports":{"three":"http://127.0.0.1:${port}/three/build/three.module.js",
"three/addons/":"http://127.0.0.1:${port}/three/examples/jsm/"}}
</script></head><body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FILES = ${JSON.stringify(files)};
const loader = new GLTFLoader();
const out = [];

for (const file of FILES) {
  try {
    const gltf = await loader.loadAsync('http://127.0.0.1:${port}/models/' + file);
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    const whole = new THREE.Box3().setFromObject(root);
    const span = whole.getSize(new THREE.Vector3());
    const middle = whole.getCenter(new THREE.Vector3());

    /*
     * Gom theo ten mang vat lieu, vi mot mang co the duoc nhieu luoi dung.
     * Voi moi mang ta giu hop bao chung va tong so dinh.
     */
    const pack = new Map();
    root.traverse((part) => {
      if (part.isMesh !== true) {
        return;
      }
      const list = Array.isArray(part.material) ? part.material : [part.material];
      const name = list.map((m) => m?.name ?? '').join('+') || '(khong ten)';
      const box = new THREE.Box3().setFromObject(part);
      const spot = part.geometry.getAttribute('position');
      const already = pack.get(name);
      if (already) {
        already.box.union(box);
        already.points += spot ? spot.count : 0;
      } else {
        pack.set(name, { box, points: spot ? spot.count : 0 });
      }
    });

    out.push({
      file,
      span: { x: span.x, y: span.y, z: span.z },
      middle: { x: middle.x, y: middle.y, z: middle.z },
      low: { x: whole.min.x, y: whole.min.y, z: whole.min.z },
      high: { x: whole.max.x, y: whole.max.y, z: whole.max.z },
      parts: [...pack].map(([name, one]) => ({
        name,
        points: one.points,
        low: { x: one.box.min.x, y: one.box.min.y, z: one.box.min.z },
        high: { x: one.box.max.x, y: one.box.max.y, z: one.box.max.z },
      })),
    });
  } catch (error) {
    out.push({ file, error: String(error) });
  }
}
window.results = out;
</script></body></html>`;
}

/**
 * Doan vung cua tung mang.
 *
 * Doan theo cho mang nam tren con vat, quy ve ti le cua ca con de mo hinh to
 * hay nho deu doc duoc nhu nhau. Mang nao khong roi vao dau thi thuoc long
 * chu dao, vi do la phan chiem nhieu nhat tren mot con vat.
 */
function guessZones(one) {
  const span = {
    x: Math.max(one.span.x, 1e-6),
    y: Math.max(one.span.y, 1e-6),
    z: Math.max(one.span.z, 1e-6),
  };
  const total = one.parts.reduce((sum, part) => sum + part.points, 0);

  const scored = one.parts.map((part) => {
    const high = (part.high.y - one.low.y) / span.y;
    const low = (part.low.y - one.low.y) / span.y;
    const tall = (part.high.y - part.low.y) / span.y;
    const deep = (part.high.z - part.low.z) / span.z;
    const long = (part.high.x - part.low.x) / span.x;
    const share = total > 0 ? part.points / total : 0;
    return { ...part, high, low, tall, deep, long, share };
  });

  // Mang chiem nhieu dinh nhat va trai rong ca than la long chu dao.
  const main = [...scored].sort((a, b) => b.share - a.share)[0];

  return scored.map((part) => ({
    name: part.name,
    zone: zoneOf(part, main),
    share: Math.round(part.share * 100),
  }));
}

/** Chon vung cho mot mang, theo thu tu tu dac trung nhat den chung nhat. */
function zoneOf(part, main) {
  if (part === main) {
    return 'MAIN_FUR';
  }
  const tiny = part.share < 0.06;
  // Mat va mui nam cao va rat nho. Mui thap hon mat mot chut va nho hon nua.
  if (tiny && part.high > 0.75) {
    return part.share < 0.02 ? 'NOSE' : 'EYE';
  }
  // Tai nam tren dinh, cao va mong.
  if (part.high > 0.88 && part.tall < 0.25) {
    return 'EAR';
  }
  // Duoi nam cao va gon, khong trai rong theo than.
  if (part.long < 0.3 && part.high > 0.5) {
    return 'TAIL';
  }
  // Phan nam thap duoi bung.
  if (part.low < 0.35) {
    return 'BELLY_FUR';
  }
  return 'MAIN_FUR';
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const ready = manifest.baseModel.filter(
    (one) => fs.existsSync(path.join(MODELS, one.file)),
  );
  const files = [...new Set(ready.map((one) => one.file))];

  const { server, port } = await serve((p) => pageSource(p, files));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  console.log('BAN DO VUNG VAT LIEU CUA CAC MO HINH');
  console.log('='.repeat(70));
  console.log(`Sau vung co ten: ${ZONES.join(', ')}`);
  console.log('');

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.results, { timeout: 120000 }).catch(() => {
    console.log('  Trang khong doc xong. Loi:', broken.slice(0, 3).join(' | '));
    throw new Error('khong doc duoc mo hinh');
  });
  const results = await page.evaluate(() => window.results);
  await browser.close();
  server.close();

  const mapOf = {};
  for (const one of results) {
    if (one.error) {
      console.log(`${one.file}  KHONG DOC DUOC: ${one.error.slice(0, 80)}`);
      continue;
    }
    const guessed = guessZones(one);
    mapOf[one.file] = Object.fromEntries(guessed.map((each) => [each.name, each.zone]));

    const covered = new Set(guessed.map((each) => each.zone));
    const missing = ZONES.filter((zone) => !covered.has(zone));
    console.log(one.file);
    for (const each of guessed) {
      console.log(`  ${each.name.padEnd(22)} -> ${each.zone.padEnd(11)} ${each.share}% so dinh`);
    }
    console.log(
      missing.length === 0
        ? '  DU sau vung'
        : `  THIEU ${missing.length} vung: ${missing.join(', ')}`,
    );
    console.log('');
  }

  if (process.argv.includes('--write')) {
    manifest.zoneByFile = mapOf;
    manifest.zoneName = ZONES;
    fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log('-'.repeat(70));
    console.log('Da ghi ban do vung vao manifest.json');
  } else {
    console.log('-'.repeat(70));
    console.log('Chay lai kem --write de ghi ban do nay vao manifest.json');
  }
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
