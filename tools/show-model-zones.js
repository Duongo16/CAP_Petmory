/**
 * Ve tung mang vat lieu cua mot mo hinh ra mot o rieng, de nhin tan mat mang
 * do nam o dau tren con vat.
 *
 * Ban do vung doan bang toa do chi la phong doan. Buc anh nay la cach duy
 * nhat de biet chac mot mang ung voi vung nao, va de thay ro mot mo hinh co
 * that su tach rieng tai va duoi hay khong.
 *
 * Chay: node tools/show-model-zones.js q-ShibaInu.glb
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MODELS = path.join(ROOT, 'apps', 'web', 'public', 'models');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const OUT = path.join(ROOT, 'test-screenshots');

/** Canh cua mot o trong tam anh ghep. */
const TILE = 420;

/** Bao nhieu o tren mot hang. */
const ACROSS = 3;

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

function pageSource(port, file) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style>
<script type="importmap">
{"imports":{"three":"http://127.0.0.1:${port}/three/build/three.module.js",
"three/addons/":"http://127.0.0.1:${port}/three/examples/jsm/"}}
</script></head><body>
<canvas id="stage" width="${TILE}" height="${TILE}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TILE = ${TILE};
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(TILE, TILE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const gltf = await new GLTFLoader().loadAsync('http://127.0.0.1:${port}/models/${file}');
const model = gltf.scene;
model.traverse((part) => { if (part.isBone === true) { part.visible = false; } });

/* Gom cac mang luoi theo ten vat lieu. */
const groupOf = new Map();
model.traverse((part) => {
  if (part.isMesh !== true) { return; }
  const list = Array.isArray(part.material) ? part.material : [part.material];
  const name = list.map((m) => m?.name ?? '').join('+') || '(khong ten)';
  const already = groupOf.get(name) ?? [];
  already.push(part);
  groupOf.set(name, already);
});

const names = [...groupOf.keys()];
const out = [];

for (const picked of names) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6efe6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbba98f, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);

  const copy = model.clone(true);
  copy.traverse((part) => {
    if (part.isMesh !== true) { return; }
    const list = Array.isArray(part.material) ? part.material : [part.material];
    const name = list.map((m) => m?.name ?? '').join('+') || '(khong ten)';
    part.material = new THREE.MeshStandardMaterial({
      color: name === picked ? 0xd0342c : 0xdcd3c6,
      roughness: 0.9,
      metalness: 0,
      transparent: name !== picked,
      opacity: name === picked ? 1 : 0.5,
    });
  });

  const box = new THREE.Box3().setFromObject(copy);
  const middle = box.getCenter(new THREE.Vector3());
  copy.position.sub(middle);
  scene.add(copy);

  const sphere = new THREE.Box3().setFromObject(copy).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(30, 1, sphere.radius / 100, sphere.radius * 20);
  const away = (sphere.radius * 1.25) / Math.sin((30 * Math.PI) / 360);
  camera.position.set(0.55, 0.28, 0.9).normalize().multiplyScalar(away);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  out.push({ name: picked, picture: canvas.toDataURL('image/png') });
}

window.results = out;
</script></body></html>`;
}

/** Ghep cac o lai thanh mot tam, kem ten mang duoi moi o. */
async function stitch(page, tiles, where) {
  const sheet = await page.evaluate(
    async ([list, tile, across]) => {
      const rows = Math.ceil(list.length / across);
      const board = document.createElement('canvas');
      board.width = tile * across;
      board.height = (tile + 34) * rows;
      const brush = board.getContext('2d');
      brush.fillStyle = '#ffffff';
      brush.fillRect(0, 0, board.width, board.height);
      for (let i = 0; i < list.length; i += 1) {
        const x = (i % across) * tile;
        const y = Math.floor(i / across) * (tile + 34);
        const image = new Image();
        await new Promise((done) => {
          image.onload = done;
          image.src = list[i].picture;
        });
        brush.drawImage(image, x, y);
        brush.fillStyle = '#231a13';
        brush.font = '600 20px sans-serif';
        brush.textAlign = 'center';
        brush.fillText(list[i].name, x + tile / 2, y + tile + 24);
      }
      return board.toDataURL('image/png');
    },
    [tiles, TILE, ACROSS],
  );
  fs.writeFileSync(where, Buffer.from(sheet.split(',')[1], 'base64'));
}

async function run() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(path.join(MODELS, file))) {
    console.log('Hay cho biet ten tep mo hinh, vi du: node tools/show-model-zones.js q-Fox.glb');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const { server, port } = await serve((p) => pageSource(p, file));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: TILE, height: TILE } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.results, { timeout: 120000 }).catch(() => {
    console.log('Trang khong ve xong. Loi:', broken.slice(0, 3).join(' | '));
    throw new Error('khong ve duoc');
  });
  const tiles = await page.evaluate(() => window.results);
  const where = path.join(OUT, `zones-${file.replace(/\.glb$/, '')}.png`);
  await stitch(page, tiles, where);

  await browser.close();
  server.close();
  console.log(`${file}: ${tiles.length} mang vat lieu`);
  for (const one of tiles) {
    console.log(`  ${one.name}`);
  }
  console.log(`Anh ghep: ${where}`);
}

run().catch((trouble) => {
  console.error('Khong chay duoc:', trouble.message);
  process.exit(1);
});
