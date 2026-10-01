/**
 * Renders the demo pictures the site needs, from the 3D models already in the
 * repository.
 *
 * The screens were built with empty picture slots, which made the whole site
 * look broken during a demonstration. Photographs of real pets cannot be used
 * without knowing where they came from, so the pictures are rendered from the
 * Cube Pets models by Kenney, which are public domain, on the same cream and
 * purple the interface uses. Nothing is downloaded and nothing is borrowed.
 *
 * Run: node tools/make-demo-images.js
 * Add --upload to send them to the picture service as well.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');

/*
 * Be rong va muc nen cua anh sau khi da ve xong.
 *
 * Anh ve ra o do phan giai cao de net, nhung de nguyen thi moi tep nang gan
 * hai megabyte. Mot the san pham khong can den chung do: tren mang cham, sau
 * tam anh nhu vay lam trang cho hang chuc giay moi hien xong.
 */
const SHIP_EDGE = 1000;
const SHIP_QUALITY = 72;
const MODELS = path.join(ROOT, 'apps', 'web', 'public', 'models');
const THREE_DIR = path.join(ROOT, 'node_modules', 'three');
const OUT = path.join(ROOT, 'apps', 'web', 'public', 'demo');

/**
 * What to render.
 *
 * The shaped models are used wherever one fits, because the cube models read
 * as toy blocks rather than as an animal, and these pictures are the first
 * thing a visitor sees. The cube models stay for the pieces that really are
 * several animals or a boxed set, where the blocky look does no harm.
 *
 * Each entry names a model, how far it is turned, and the wash behind it.
 */
const PICTURES = [
  { name: 'pt-01', model: 'q-ShibaInu.glb', angle: -35, tone: 'cream' },
  { name: 'pt-02', model: 'q-Fox.glb', angle: -28, tone: 'blush' },
  { name: 'pt-03', model: 'q-Husky.glb', angle: -45, tone: 'amber' },
  // Bo nhieu be thi phai co nhieu be trong anh, khong the chi mot con.
  { name: 'pt-04', model: ['q-ShibaInu.glb', 'q-Fox.glb', 'q-Husky.glb'], angle: -30, tone: 'cream' },
  { name: 'pt-05', model: 'q-Husky.glb', angle: 18, tone: 'blush' },
  { name: 'hero', model: 'q-Husky.glb', angle: -38, tone: 'amber' },
  { name: 'keepsake', model: 'q-ShibaInu.glb', angle: -25, tone: 'cream' },
  { name: 'memory', model: 'q-Fox.glb', angle: -48, tone: 'amber' },
];

const SIZE = 1200;

/** Serves the model files and the three.js build to the page being rendered. */
function serve(pageFor) {
  const TYPES = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png' };
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

/** The page that does the drawing. Kept here so there is no stray file to clean up. */
function pageSource(port, jobs) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style>
<script type="importmap">
{"imports":{"three":"http://127.0.0.1:${port}/three/build/three.module.js",
"three/addons/":"http://127.0.0.1:${port}/three/examples/jsm/"}}
</script></head>
<body><canvas id="stage" width="${SIZE}" height="${SIZE}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * Every picture is drawn while the page is still loading, on purpose.
 *
 * In a browser with no screen the drawing buffer is taken back as soon as the
 * page goes idle, and anything drawn after that comes out blank with no error
 * of any kind. Doing all the work in one go, before control ever returns to the
 * driver, is what keeps the buffer alive.
 */
const JOBS = ${JSON.stringify(jobs)};
const SIZE = ${SIZE};

const TONE = {
  cream: ['#fffaf6', '#fff1ea', '#f6ddcd'],
  blush: ['#fff4ee', '#fdeae0', '#f2d3c2'],
  amber: ['#fff8ec', '#fdeac9', '#f7d2a0'],
};

/** Mau bong do xuong san, lay theo tong nen cho khoi bi xam xit. */
const SHADOW_TINT = {
  cream: 0x7a5340,
  blush: 0x7a4a38,
  amber: 0x7a4f22,
};

for (const one of JOBS) {
  one.shadowTint = SHADOW_TINT[one.tone];
}

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
/*
 * Anh sang duoc nen lai theo kieu phim, khong cat thang o muc sang nhat.
 * Khong co buoc nay thi lung va dinh dau bi chay trang thanh mot mang bet.
 */
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/*
 * Anh sang cua ca can phong, khong chi may ngon den roi thang.
 *
 * Chi co den roi thang thi mat khuat cua con vat chet den va bo mat tron nhu
 * nhua. Mot can phong dung san cho anh sang doi qua doi lai, nen cho nao cung
 * co chut sang, va be mat co cai de phan chieu.
 */
const moldEnv = new THREE.PMREMGenerator(renderer);
const lightRoom = moldEnv.fromScene(new RoomEnvironment(), 0.04).texture;

/**
 * Mot lop hat min, dung lam do go cho be mat.
 *
 * Len chuc khong bao gio nhan. Dap lop hat nay len thi anh sang bi be nho ra
 * thanh vo so cham sang toi, mat nhin ra so len chu khong ra vo nhua.
 */
function fuzzTexture() {
  const skin = document.createElement('canvas');
  skin.width = 256;
  skin.height = 256;
  const brush = skin.getContext('2d');
  const grain = brush.createImageData(256, 256);
  for (let i = 0; i < grain.data.length; i += 4) {
    const shade = 120 + Math.floor(Math.random() * 136);
    grain.data[i] = shade;
    grain.data[i + 1] = shade;
    grain.data[i + 2] = shade;
    grain.data[i + 3] = 255;
  }
  brush.putImageData(grain, 0, 0);
  const texture = new THREE.CanvasTexture(skin);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  return texture;
}

const FUZZ = fuzzTexture();

/**
 * Doi vat lieu cua mot mang luoi sang vat lieu len.
 *
 * Giu nguyen mau va anh dan cua ban goc, chi doi cach be mat bat sang: nham
 * het muc, khong anh kim loai, va them lop anh to noi tren mat soi. Ba thu do
 * cong lai la khac biet giua mot mon do len va mot mon do nhua.
 */
function woolOf(first) {
  const tint = first.color ? first.color.clone() : new THREE.Color(0xffffff);
  const glowSoft = tint.clone().lerp(new THREE.Color(0xfff6ec), 0.34);
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    map: first.map ?? null,
    roughness: 1,
    metalness: 0,
    sheen: 0.45,
    sheenRoughness: 0.9,
    sheenColor: glowSoft,
    bumpMap: FUZZ,
    bumpScale: 1.1,
    transparent: first.transparent === true,
    opacity: first.opacity ?? 1,
    side: first.side ?? THREE.FrontSide,
  });
}

/**
 * Lam mem cac canh gay cua mo hinh it mat.
 *
 * Mo hinh goc dung rat it mat nen nhin ra khoi da giac. Tinh lai phap tuyen
 * theo goc gap lon thi anh sang chay lien qua cac mat, than con vat tron lai,
 * chi con nhung canh that su gay moi giu net.
 */
function softenEdge(part) {
  if (part.geometry.attributes.position === undefined) {
    return;
  }
  part.geometry = toCreasedNormals(part.geometry, Math.PI * 0.55);
}

/**
 * Trai san mot bo toa do anh cho nhung mo hinh khong co san.
 *
 * Cac mo hinh nay to bang mau thang, khong dung anh dan, nen tac gia khong
 * kem toa do anh. Khong co toa do thi lop hat min khong bam vao dau duoc.
 * O day moi mat tam giac duoc chieu thang xuong mat phang nao no huong ra
 * nhieu nhat, cach do cho hat deu nhau khap than, khong cho nao bi keo dai.
 */
function wrapUv(part) {
  const shape = part.geometry;
  if (shape.getAttribute('uv') || shape.index) {
    return;
  }
  const spot = shape.getAttribute('position');
  const grid = new Float32Array(spot.count * 2);
  const one = new THREE.Vector3();
  const two = new THREE.Vector3();
  const three = new THREE.Vector3();
  const armA = new THREE.Vector3();
  const armB = new THREE.Vector3();
  const facing = new THREE.Vector3();
  for (let i = 0; i + 2 < spot.count; i += 3) {
    one.fromBufferAttribute(spot, i);
    two.fromBufferAttribute(spot, i + 1);
    three.fromBufferAttribute(spot, i + 2);
    armA.subVectors(two, one);
    armB.subVectors(three, one);
    facing.crossVectors(armA, armB);
    const towardX = Math.abs(facing.x);
    const towardY = Math.abs(facing.y);
    const towardZ = Math.abs(facing.z);
    let acrossKey = 'z';
    let upKey = 'y';
    if (towardY >= towardX && towardY >= towardZ) {
      acrossKey = 'x';
      upKey = 'z';
    } else if (towardZ >= towardX && towardZ >= towardY) {
      acrossKey = 'x';
      upKey = 'y';
    }
    const trio = [one, two, three];
    for (let k = 0; k < 3; k += 1) {
      grid[(i + k) * 2] = trio[k][acrossKey];
      grid[(i + k) * 2 + 1] = trio[k][upKey];
    }
  }
  shape.setAttribute('uv', new THREE.BufferAttribute(grid, 2));
}

/**
 * Nen phia sau: mot quang sang toa tron o giua roi toi dan ra ria.
 *
 * Truoc day la mot dai mau doc thang, nhin phang nhu giay dan tuong. Quang
 * tron nay tach hinh khoi nen va keo mat nguoi xem vao giua, giong mot tam
 * anh chup trong tiem hon.
 */
function washFor(tone) {
  const wash = document.createElement('canvas');
  wash.width = 512;
  wash.height = 512;
  const brush = wash.getContext('2d');
  const glow = brush.createRadialGradient(256, 215, 40, 256, 256, 330);
  glow.addColorStop(0, TONE[tone][0]);
  glow.addColorStop(0.55, TONE[tone][1]);
  glow.addColorStop(1, TONE[tone][2]);
  brush.fillStyle = glow;
  brush.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(wash);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function drawOne(job) {
  const scene = new THREE.Scene();
  scene.background = washFor(job.tone);
  scene.environment = lightRoom;
  scene.environmentIntensity = 0.28;

  /*
   * Ba nguon sang, dung nhu cach bay mot mon do trong tiem:
   * mot nguon chinh am chech tren, mot nguon phu lanh ben kia de mang bong
   * khoi den kit, va mot vien sang phia sau de tach hinh ra khoi nen.
   */
  scene.add(new THREE.HemisphereLight(0xfff6ee, 0xd8bda7, 0.9));

  const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
  key.position.set(3.2, 5.4, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 4;
  key.shadow.bias = -0.0015;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffeedd, 0.85);
  fill.position.set(-4.2, 1.6, 2.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd9a8, 1.6);
  rim.position.set(-2.2, 3.2, -4.4);
  scene.add(rim);

  /*
   * Mot buc co the co mot be hoac nhieu be. Nhieu be thi xep hang ngang,
   * cach nhau theo be rong cua chinh chung, va con giua lui ve sau mot chut
   * de hang khong bi phang nhu xep hinh.
   */
  const names = Array.isArray(job.model) ? job.model : [job.model];
  const loader = new GLTFLoader();
  const model = new THREE.Group();
  const loaded = [];

  for (const name of names) {
    const gltf = await loader.loadAsync('http://127.0.0.1:${port}/models/' + name);
    const one = gltf.scene;
    /*
     * Vai mo hinh den kem mot khung xuong va tu dat o tu the chu T.
     * Bo khung di thi chung tro ve dang nghi, la dang dung de chup.
     */
    one.traverse((part) => {
      if (part.isBone === true) {
        part.visible = false;
      }
      if (part.isMesh !== true) {
        return;
      }
      softenEdge(part);
      wrapUv(part);
      part.material = Array.isArray(part.material)
        ? part.material.map(woolOf)
        : woolOf(part.material);
    });
    loaded.push(one);
  }

  if (loaded.length === 1) {
    model.add(loaded[0]);
  } else {
    let offset = 0;
    const widths = [];
    for (const one of loaded) {
      widths.push(new THREE.Box3().setFromObject(one).getSize(new THREE.Vector3()).x);
    }
    const gap = Math.max(...widths) * 0.22;
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (loaded.length - 1);
    offset = -total / 2;
    loaded.forEach((one, at) => {
      one.position.x = offset + widths[at] / 2;
      // Con giua lui ve sau, hai con ngoai nhich len, cho hang co chieu sau.
      one.position.z = at === Math.floor(loaded.length / 2) ? -widths[at] * 0.28 : 0;
      offset += widths[at] + gap;
      model.add(one);
    });
  }

  /*
   * Cac mo hinh khong cung mot huong mac dinh: co con quay mat theo truc Z,
   * co con theo truc X. Neu chi xoay theo goc ghi san thi con ra anh nghieng,
   * con ra anh chinh dien. O day do be nam dai theo truc nao, xoay cho canh
   * dai nam ngang truoc da, roi moi cong them goc cua tung buc.
   */
  const first = new THREE.Box3().setFromObject(model);
  const span = first.getSize(new THREE.Vector3());
  if (span.z > span.x) {
    model.rotation.y = Math.PI / 2;
  }
  model.rotation.y += (job.angle * Math.PI) / 180;
  scene.add(model);

  /*
   * Khung hinh duoc tinh tu chinh kich thuoc mo hinh sau khi xoay.
   * Cac mo hinh dai ngan khac nhau, nen neu dat san mot khoang cach thi con
   * dai se be ti con con tron se tran ra ngoai.
   */
  const box = new THREE.Box3().setFromObject(model);
  const middle = box.getCenter(new THREE.Vector3());
  model.position.sub(middle);

  // Moi be phai do bong xuong san, va nhan bong cua chinh minh len lung.
  model.traverse((part) => {
    if (part.isMesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });

  const measured = new THREE.Box3().setFromObject(model);
  const sphere = measured.getBoundingSphere(new THREE.Sphere());

  /*
   * Mot mat san chi de hung bong, ban than no trong suot.
   * Co bong tiep dat thi con vat moi dung tren mot cho, khong lo lung.
   */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(sphere.radius * 14, sphere.radius * 14),
    new THREE.ShadowMaterial({ color: job.shadowTint, opacity: 0.26 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = measured.min.y - sphere.radius * 0.01;
  floor.receiveShadow = true;
  scene.add(floor);

  key.target.position.set(0, measured.min.y, 0);
  scene.add(key.target);
  key.shadow.camera.left = -sphere.radius * 2;
  key.shadow.camera.right = sphere.radius * 2;
  key.shadow.camera.top = sphere.radius * 2;
  key.shadow.camera.bottom = -sphere.radius * 2;
  key.shadow.camera.near = sphere.radius * 0.1;
  key.shadow.camera.far = sphere.radius * 14;
  key.shadow.camera.updateProjectionMatrix();

  const fov = 28;
  const aimAt = new THREE.Vector3(0, sphere.radius * 0.06, 0);

  /*
   * May dat hoi thap va lech sang mot ben, gan ngang tam mat con vat.
   * Nhin tu tren xuong thi ra anh mau vat, ngang tam mat thi ra anh chan dung.
   */
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.01, 1000);
  const heading = new THREE.Vector3(0.46, 0.20, 0.86).normalize();

  /*
   * Khoang cach duoc do hai lan.
   *
   * Lan dau uoc theo ban kinh qua cau bao quanh. Cach nay luon thua, vi qua
   * cau tinh ca chieu sau ma nhin tu truoc thi chieu sau khong chiem cho nao
   * tren anh. Ket qua la con vat be ti giua mot khung rong.
   *
   * Lan hai chieu tam goc cua hop bao quanh len mat phang anh, do xem be that
   * su chiem bao nhieu, roi keo may lai cho vua.
   */
  let away = (sphere.radius * 1.1) / Math.sin((fov * Math.PI) / 360);
  /*
   * Lay thang cac dinh cua luoi, khong lay tam hop bao.
   *
   * Hop bao chua ca chieu sau. Nhin cheo thi goc xa nhat cua hop chieu ra
   * ngoai ria anh trong khi con vat chua cham toi day, nen may bi lui qua xa
   * va con vat ngoi be giua mot khung rong. Dem dinh luoi thi do dung phan
   * that su nhin thay.
   */
  const corners = [];
  model.updateMatrixWorld(true);
  model.traverse((part) => {
    if (!part.isMesh) {
      return;
    }
    const spot = part.geometry.getAttribute('position');
    if (!spot) {
      return;
    }
    // Luoi nhieu dinh thi lay thua ra, vi vien ngoai moi quyet dinh khung hinh.
    const step = Math.max(1, Math.floor(spot.count / 900));
    for (let i = 0; i < spot.count; i += step) {
      corners.push(
        new THREE.Vector3(spot.getX(i), spot.getY(i), spot.getZ(i)).applyMatrix4(part.matrixWorld),
      );
    }
  });
  if (corners.length === 0) {
    for (const x of [measured.min.x, measured.max.x]) {
      for (const y of [measured.min.y, measured.max.y]) {
        for (const z of [measured.min.z, measured.max.z]) {
          corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
  }

  const FILL = 0.88;
  for (let pass = 0; pass < 3; pass += 1) {
    camera.position.copy(heading).multiplyScalar(away).add(aimAt);
    camera.near = away / 100;
    camera.far = away * 12;
    camera.lookAt(aimAt);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    let widest = 0;
    for (const corner of corners) {
      const seen = corner.clone().project(camera);
      widest = Math.max(widest, Math.abs(seen.x), Math.abs(seen.y));
    }
    away *= widest / FILL;
  }

  camera.position.copy(heading).multiplyScalar(away).add(aimAt);
  camera.near = away / 100;
  camera.far = away * 12;
  camera.lookAt(aimAt);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);

  const dot = new Uint8Array(4);
  const ctx = renderer.getContext();
  ctx.readPixels(SIZE / 2, SIZE / 2, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, dot);

  /*
   * Mot vong toi rat nhe o bon goc, ve sau khi da dung xong.
   *
   * Anh dung tu may tinh thuong sang deu tu ria vao giua nen nhin phang.
   * Goc toi di mot chut la cach ong kinh that van lam, va mat nguoi xem se
   * dung lai o giua khung.
   */
  const flat = document.createElement('canvas');
  flat.width = SIZE;
  flat.height = SIZE;
  const paint = flat.getContext('2d');
  paint.drawImage(canvas, 0, 0);
  const edgeDark = paint.createRadialGradient(
    SIZE / 2, SIZE * 0.46, SIZE * 0.3,
    SIZE / 2, SIZE / 2, SIZE * 0.74,
  );
  edgeDark.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeDark.addColorStop(1, 'rgba(74, 44, 30, 0.15)');
  paint.fillStyle = edgeDark;
  paint.fillRect(0, 0, SIZE, SIZE);

  return {
    name: job.name,
    picture: flat.toDataURL('image/png'),
    middlePixel: Array.from(dot).join(','),
    buffer: ctx.drawingBufferWidth + 'x' + ctx.drawingBufferHeight,
  };
}

(async () => {
  const out = [];
  for (const job of JOBS) {
    try {
      out.push(await drawOne(job));
    } catch (error) {
      out.push({ name: job.name, error: String(error) });
    }
  }
  window.results = out;
})();
</script></body></html>`;
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, port } = await serve((p) => pageSource(p, PICTURES));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
  const broken = [];
  page.on('pageerror', (e) => broken.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      broken.push(m.text());
    }
  });

  console.log('RENDERING DEMO PICTURES');
  console.log('='.repeat(64));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.results, { timeout: 120000 }).catch(() => {
    console.log('  The page never finished. Errors seen:');
    for (const line of broken.slice(0, 5)) {
      console.log('   ', line);
    }
    throw new Error('rendering never finished');
  });

  const results = await page.evaluate(() => window.results);
  await browser.close();
  server.close();

  const made = [];
  for (const one of results) {
    if (one.error) {
      console.log(`  ${one.name.padEnd(10)} FAILED: ${one.error.slice(0, 70)}`);
      continue;
    }
    const bytes = Buffer.from(one.picture.split(',')[1], 'base64');
    // A picture with nothing drawn on it compresses to almost nothing, so the
    // size is what catches a silent blank rather than any message.
    if (bytes.length < 25000) {
      console.log(
        `  ${one.name.padEnd(10)} BLANK: ${bytes.length} bytes, ` +
          `middle pixel ${one.middlePixel}, buffer ${one.buffer}`,
      );
      continue;
    }
    const where = path.join(OUT, `${one.name}.png`);
    const light = await sharp(bytes)
      .resize(SHIP_EDGE, SHIP_EDGE, { fit: 'inside', withoutEnlargement: true })
      .png({ palette: true, quality: SHIP_QUALITY, compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(where, light);
    made.push({ name: one.name, file: where });
    console.log(
      `  ${one.name.padEnd(10)} ${(light.length / 1024).toFixed(0)} KB` +
        ` (ve ra ${(bytes.length / 1024).toFixed(0)} KB)`,
    );
  }

  console.log('-'.repeat(64));
  console.log(`${made.length} of ${PICTURES.length} pictures written to apps/web/public/demo`);

  if (process.argv.includes('--upload')) {
    await upload(made);
  }
  process.exit(made.length === PICTURES.length ? 0 : 1);
}

/** Sends the finished pictures to the picture service as public files. */
async function upload(made) {
  const line = fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'));
  const env = Object.fromEntries(
    line.map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
  if (!env.CLOUDINARY_CLOUD_NAME) {
    console.log('No picture service configured, so nothing was sent.');
    return;
  }
  const { v2: cloudinary } = require('cloudinary');
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('');
  console.log('Sending to the picture service');
  const sent = [];
  for (const one of made) {
    /*
     * Dia chi anh khong mang so phien ban, de co so du lieu khong phai sua
     * theo moi lan gui. Doi lai, mang phan phoi van giu ban cu trong bo nho
     * dem: gui anh moi len ma khong bao xoa thi trang web hien ra anh cu,
     * lan truoc da bi dung nay danh lua.
     */
    const answer = await cloudinary.uploader.upload(one.file, {
      public_id: `petmory/demo/${one.name}`,
      format: 'png',
      type: 'upload',
      overwrite: true,
      invalidate: true,
    });
    sent.push({ name: one.name, url: answer.secure_url });
    console.log(`  ${one.name.padEnd(10)} ${answer.secure_url}`);
  }

  await pointProductsAt(env, sent);
}

/**
 * Ghi dia chi vua gui vao danh muc san pham.
 *
 * Dia chi tra ve co mang so phien ban. Do la thu duy nhat chac chan tro dung
 * anh vua gui: dia chi khong co so phien ban bi mang phan phoi giu trong bo
 * nho dem hang gio, nen trang web van hien anh cu du anh moi da len den noi.
 */
async function pointProductsAt(env, sent) {
  const uri = env.MONGODB_URI;
  if (!uri) {
    console.log('');
    console.log('Khong thay dia chi co so du lieu, nen danh muc chua duoc cap nhat.');
    return;
  }

  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  try {
    await client.connect();
    const products = client.db().collection('product_types');
    console.log('');
    console.log('Cap nhat dia chi anh trong danh muc');
    for (const one of sent) {
      if (!one.name.startsWith('pt-')) {
        continue;
      }
      const code = one.name.toUpperCase();
      const done = await products.updateOne({ code }, { $set: { imageUrl: one.url } });
      console.log(`  ${code.padEnd(10)} ${done.matchedCount === 1 ? 'da cap nhat' : 'khong thay san pham'}`);
    }
  } finally {
    await client.close();
  }
}

run().catch((e) => {
  console.error('Rendering failed:', e.message);
  process.exit(1);
});
