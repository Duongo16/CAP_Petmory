/**
 * Dung bo mau "chi dau" cho san pham len chọc: dau cho meo tron mem, mat bi to.
 *
 * Moi bo phan la mot khoi cau keo gian, mat ngoai gon nhe nhu len da chọc chat,
 * gan dung mot vung vat lieu. Mau dau khong co duoi nen khong co vung PM_TAIL,
 * va khong co diem neo lung; chi co neo dau, mat va co de deo mu, kinh, no, vong.
 * Moi mau xuat hai ban: ban nhe cho dien thoai va ban day du cho xuong.
 *
 * Tu dung nen giay phep la CC0, khong can ghi cong.
 * Chay: node tools/build-head-models.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mkdirSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((raw) => {
      this.result = raw;
      this.onloadend?.();
    });
  }
};

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = join(HERE, '..', 'apps', 'web', 'public', 'models');
// Ghi ra thu muc tam truoc roi moi chuyen vao, de may chu phat trien khong tai lai giua chung.
const STAGE = join(tmpdir(), `pm-heads-${Date.now()}`);

/** Dung trong don vi "ban kinh dau = 1" roi thu ve met, cung co voi bon mau nen. */
const SCALE = 0.033;

const ZONE = {
  MAIN: 'PM_FUR_MAIN',
  BELLY: 'PM_FUR_SECONDARY',
  EARS: 'PM_EARS',
  EYES: 'PM_EYES',
  NOSE: 'PM_NOSE',
  // Ten da khai trong manifest (nhan "Dong tu"), ban do vung tinh vao vung mat.
  PUPIL: 'Eyes_Pupil',
};

/** So doan cua khoi lon va khoi nho theo tung ban. */
const DETAIL = {
  lite: { big: [40, 28], small: [18, 12] },
  full: { big: [96, 64], small: [40, 28] },
};

/**
 * Do gon cua mat len: tong vai song sin cham, du de mat khong nhan nhu nhua
 * ma van tron mem. Tinh tren khoi cau don vi nen moi khoi gon cung mot kieu.
 */
function lump(x, y, z, seed) {
  return (
    Math.sin(x * 3.1 + seed) * Math.sin(y * 2.7 + seed * 1.7) * Math.sin(z * 3.3 + seed * 0.6) +
    0.55 * Math.sin(x * 6.3 + y * 4.1 + seed * 2.3) * Math.sin(z * 5.7 - y * 3.9 + seed) +
    0.3 * Math.sin(x * 11.1 - z * 9.3 + seed * 3.1) * Math.sin(y * 10.7 + seed * 0.4)
  );
}

/** Vat lieu cua tung vung: long thi li va co anh to, mat bi bong, mui hoi bong. */
function material(zone, color) {
  if (zone === 'EYES' || zone === 'PUPIL') {
    return new THREE.MeshPhysicalMaterial({ name: ZONE[zone], color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  }
  if (zone === 'NOSE') {
    return new THREE.MeshPhysicalMaterial({ name: ZONE[zone], color, roughness: 0.55 });
  }
  return new THREE.MeshPhysicalMaterial({
    name: ZONE[zone],
    color,
    roughness: 1,
    sheen: 1,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#5a5a5a'),
  });
}

/** Bo cong cu dung khoi cho mot con, theo bang mau rieng va do min cua ban. */
function kit(detail, palette) {
  const made = Object.fromEntries(
    Object.keys(ZONE).map((zone) => [zone, material(zone, palette[zone] ?? '#141110')]),
  );
  let count = 0;

  /**
   * Mot khoi cau keo gian.
   * - radii: ba ban kinh theo x, y, z.
   * - taper: thu nho dan ve phia +y, dung cho tai nhon (1 la nhon han).
   * - bend: uon dinh khoi ra sau, cho tai dung hoi nga.
   * - rough: do gon cua mat len, 0 la tron lang nhu mat bi.
   */
  const blob = (zone, radii, at, opts = {}) => {
    const { turn = [0, 0, 0], taper = 0, bend = 0, rough = 0.035, small = false } = opts;
    const [ws, hs] = small ? detail.small : detail.big;
    const geometry = new THREE.SphereGeometry(1, ws, hs);
    const pos = geometry.getAttribute('position');
    const seed = (count + 1) * 1.37;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const up = Math.max(0, v.y);
      const narrow = 1 - taper * up * up;
      const push = 1 + rough * lump(v.x, v.y, v.z, seed);
      v.x *= narrow * push;
      v.z = v.z * narrow * push - bend * up * up;
      v.y *= push;
      pos.setXYZ(i, v.x * radii[0] * SCALE, v.y * radii[1] * SCALE, v.z * radii[2] * SCALE);
    }
    geometry.computeVertexNormals();
    // Dinh o hai cuc khoi cau bi thu lai mot diem nen phap tuyen bang khong; cho huong len de tep hop le.
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i += 1) {
      if (v.fromBufferAttribute(normal, i).lengthSq() < 0.5) {
        normal.setXYZ(i, 0, Math.sign(pos.getY(i)) || 1, 0);
      }
    }
    const mesh = new THREE.Mesh(geometry, made[zone]);
    mesh.position.set(at[0] * SCALE, at[1] * SCALE, at[2] * SCALE);
    mesh.rotation.set(...turn);
    count += 1;
    mesh.name = `${ZONE[zone]}_${count}`;
    return mesh;
  };

  /** Hai ban doi xung qua mat phang giua mat: x doi dau, goc quay quanh y va z doi dau. */
  const pair = (zone, radii, at, opts = {}) => {
    const [tx = 0, ty = 0, tz = 0] = opts.turn ?? [];
    return [-1, 1].map((side) =>
      blob(zone, radii, [at[0] * side, at[1], at[2]], { ...opts, turn: [tx, ty * side, tz * side] }),
    );
  };

  /** Dat mot nhom doi xung hai ben, goc quay quanh y va z doi dau theo ben. */
  const mirrored = (build, at, turn) =>
    [-1, 1].map((side) => {
      const group = new THREE.Group();
      group.add(...build());
      group.position.set(at[0] * side * SCALE, at[1] * SCALE, at[2] * SCALE);
      group.rotation.set(turn[0], turn[1] * side, turn[2] * side);
      return group;
    });

  /**
   * Tai: lop ngoai mau tai, long trong mau sang. Long trong cung do thon va do
   * uon voi lop ngoai, nam lun vao mat truoc, nen khong lo ra mep tai.
   */
  const ears = (radii, at, turn, opts = {}) => {
    const { taper = 0.75, bend = 0.12, inner = true } = opts;
    return mirrored(() => {
      const outer = blob('EARS', radii, [0, 0, 0], { taper, bend, rough: 0.012 });
      if (!inner) {
        return [outer];
      }
      const lining = blob('BELLY', [radii[0] * 0.62, radii[1] * 0.72, radii[2] * 0.42], [0, -radii[1] * 0.12, radii[2] * 0.74], {
        taper,
        bend,
        rough: 0,
        small: true,
      });
      return [outer, lining];
    }, at, turn);
  };

  /** Mat bi: trong mat mau, dong tu den tron dinh tren mat truoc. */
  const eyes = (radii, at, turn, pupil = 0.56) =>
    mirrored(() => {
      const ball = blob('EYES', radii, [0, 0, 0], { rough: 0, small: true });
      if (!pupil) {
        return [ball];
      }
      const dot = blob('PUPIL', [radii[0] * pupil, radii[1] * pupil * 1.1, radii[2] * 0.5], [0, 0, radii[2] * 0.62], {
        rough: 0,
        small: true,
      });
      return [ball, dot];
    }, at, turn);

  /**
   * Mang mau tren mat (soc tran, mat na): khoi sau theo truc z, dat lun trong dau
   * nen chi mot lop mong nho ra o mat truoc va om theo do cong cua dau.
   */
  const patch = (zone, radii, at, opts = {}) => blob(zone, radii, at, { rough: 0.015, ...opts });

  return { blob, pair, ears, eyes, patch };
}

/** Nut neo phu kien: vi tri va do lon ma phu kien don vi se giu. */
function anchor(name, at, size) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(at[0] * SCALE, at[1] * SCALE, at[2] * SCALE);
  node.scale.setScalar(size * SCALE);
  return node;
}

/** Ba diem neo cua mau dau: dinh dau, ngang mat va duoi cam. */
function anchors(head, eyeY, neckY) {
  const [rx, ry, rz] = head;
  return [
    anchor('PM_ANCHOR_HEAD', [0, ry * 0.92, 0], rx * 2),
    anchor('PM_ANCHOR_FACE', [0, eyeY, rz * 0.98], rx * 2),
    anchor('PM_ANCHOR_NECK', [0, neckY, 0.1], rx * 1.7),
  ];
}

/* ---------------------------------- Meo ---------------------------------- */

/** Meo Exotic: mat det, ma phung, mat to tron, tai nho dat xa nhau, mang trang giua tran. */
function catExotic(k) {
  const head = [1.14, 1.0, 0.96];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('MAIN', [0.5, 0.42, 0.44], [0.6, -0.36, 0.42]),
    ...k.pair('BELLY', [0.3, 0.25, 0.25], [0.19, -0.33, 0.86]),
    k.blob('BELLY', [0.24, 0.17, 0.2], [0, -0.56, 0.8]),
    k.patch('BELLY', [0.15, 0.44, 0.08], [0, 0.06, 0.93], { turn: [-0.3, 0, 0], taper: 0.4 }),
    ...k.eyes([0.25, 0.25, 0.13], [0.41, 0.07, 0.83], [0, 0.38, 0], 0.62),
    k.blob('NOSE', [0.1, 0.07, 0.07], [0, -0.15, 1.08], { rough: 0, small: true }),
    ...k.ears([0.3, 0.33, 0.11], [0.64, 0.76, 0.12], [-0.1, 0.25, -0.62], { taper: 0.8 }),
    k.blob('BELLY', [0.86, 0.46, 0.76], [0, -0.86, 0.02], { rough: 0.05 }),
  ];
  return { parts, fix: anchors(head, 0.07, -0.9) };
}

/** Meo Anh long ngan: dau rat tron, ma bau, mat dong to, tai nho tron. */
function catBritish(k) {
  const head = [1.16, 1.0, 0.95];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('MAIN', [0.54, 0.44, 0.46], [0.56, -0.34, 0.44]),
    ...k.pair('BELLY', [0.27, 0.23, 0.24], [0.17, -0.31, 0.84]),
    k.blob('BELLY', [0.2, 0.14, 0.17], [0, -0.53, 0.78]),
    ...k.eyes([0.22, 0.22, 0.12], [0.4, 0.1, 0.84], [0, 0.38, 0], 0.6),
    k.blob('NOSE', [0.09, 0.065, 0.06], [0, -0.13, 1.04], { rough: 0, small: true }),
    ...k.ears([0.28, 0.3, 0.1], [0.68, 0.74, 0.08], [-0.1, 0.25, -0.68], { taper: 0.65 }),
    k.blob('MAIN', [0.84, 0.46, 0.74], [0, -0.86, 0], { rough: 0.05 }),
  ];
  return { parts, fix: anchors(head, 0.1, -0.9) };
}

/** Meo Xiem: dau thon, tai to, mat hanh nghieng mau xanh, mat na sam quanh mom. */
function catSiamese(k) {
  const head = [0.98, 0.98, 0.92];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    k.patch('BELLY', [0.6, 0.55, 0.3], [0, -0.22, 0.66]),
    ...k.pair('BELLY', [0.24, 0.21, 0.22], [0.15, -0.36, 0.86]),
    k.blob('BELLY', [0.18, 0.13, 0.16], [0, -0.58, 0.76]),
    ...k.eyes([0.2, 0.12, 0.11], [0.36, 0.12, 0.8], [0, 0.4, 0.28], 0.5),
    k.blob('NOSE', [0.085, 0.06, 0.06], [0, -0.18, 1.05], { rough: 0, small: true }),
    ...k.ears([0.36, 0.5, 0.11], [0.56, 0.8, 0.02], [-0.12, 0.25, -0.45], { taper: 0.85 }),
    k.blob('MAIN', [0.66, 0.44, 0.62], [0, -0.86, -0.02], { rough: 0.04 }),
  ];
  return { parts, fix: anchors(head, 0.12, -0.9) };
}

/** Meo muop vang: dau tron vua, tai vua, mom va nguc trang, mat xanh la. */
function catTabby(k) {
  const head = [1.06, 0.96, 0.92];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('MAIN', [0.42, 0.36, 0.38], [0.56, -0.34, 0.42]),
    ...k.pair('BELLY', [0.26, 0.22, 0.23], [0.16, -0.32, 0.84]),
    k.blob('BELLY', [0.2, 0.14, 0.17], [0, -0.53, 0.76]),
    ...k.eyes([0.2, 0.2, 0.11], [0.37, 0.1, 0.81], [0, 0.38, 0], 0.55),
    k.blob('NOSE', [0.09, 0.065, 0.06], [0, -0.14, 1.03], { rough: 0, small: true }),
    ...k.ears([0.32, 0.42, 0.1], [0.6, 0.78, 0.08], [-0.1, 0.25, -0.52], { taper: 0.8 }),
    k.blob('BELLY', [0.74, 0.44, 0.68], [0, -0.86, 0.02], { rough: 0.05 }),
  ];
  return { parts, fix: anchors(head, 0.1, -0.9) };
}

/* ---------------------------------- Cho ---------------------------------- */

/** Shiba: tai tam giac dung, mom vua, ma va mom trang (urajiro), cham long may trang. */
function dogShiba(k) {
  const head = [1.0, 0.92, 0.9];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('BELLY', [0.4, 0.33, 0.34], [0.42, -0.4, 0.52]),
    k.blob('BELLY', [0.4, 0.32, 0.5], [0, -0.33, 0.88]),
    k.blob('MAIN', [0.27, 0.19, 0.46], [0, -0.1, 0.9], { turn: [0.08, 0, 0] }),
    k.blob('NOSE', [0.14, 0.1, 0.1], [0, -0.14, 1.34], { rough: 0, small: true }),
    ...k.pair('EYES', [0.11, 0.1, 0.07], [0.32, 0.13, 0.81], { turn: [0, 0.35, 0], rough: 0, small: true }),
    ...k.pair('BELLY', [0.08, 0.05, 0.04], [0.3, 0.33, 0.8], { turn: [0, 0.35, 0], rough: 0.01, small: true }),
    ...k.ears([0.3, 0.4, 0.12], [0.5, 0.78, 0.08], [-0.15, 0.3, -0.32], { taper: 0.85, bend: 0.05 }),
    k.blob('MAIN', [0.72, 0.42, 0.62], [0, -0.78, -0.08], { rough: 0.05 }),
    k.blob('BELLY', [0.5, 0.36, 0.3], [0, -0.82, 0.32], { rough: 0.04 }),
  ];
  return { parts, fix: anchors(head, 0.13, -0.85) };
}

/** Corgi: tai rat to dung, soc trang giua tran, mom trang. */
function dogCorgi(k) {
  const head = [1.02, 0.9, 0.88];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('BELLY', [0.36, 0.3, 0.32], [0.38, -0.42, 0.52]),
    k.blob('BELLY', [0.4, 0.32, 0.52], [0, -0.3, 0.86]),
    k.patch('BELLY', [0.16, 0.34, 0.045], [0, 0.26, 0.8], { turn: [-0.6, 0, 0], taper: 0.3 }),
    k.blob('NOSE', [0.15, 0.1, 0.1], [0, -0.1, 1.34], { rough: 0, small: true }),
    ...k.pair('EYES', [0.12, 0.11, 0.07], [0.34, 0.12, 0.79], { turn: [0, 0.35, 0], rough: 0, small: true }),
    ...k.ears([0.38, 0.58, 0.12], [0.56, 0.92, -0.02], [-0.12, 0.3, -0.42], { taper: 0.85, bend: 0.08 }),
    k.blob('MAIN', [0.72, 0.42, 0.62], [0, -0.76, -0.08], { rough: 0.05 }),
    k.blob('BELLY', [0.52, 0.38, 0.32], [0, -0.82, 0.3], { rough: 0.04 }),
  ];
  return { parts, fix: anchors(head, 0.12, -0.85) };
}

/** Pug: mat tron det, mat na den quanh mom, mat to, tai gap nho, nep nhan tren tran. */
function dogPug(k) {
  const head = [1.06, 0.96, 0.9];
  const parts = [
    k.blob('MAIN', head, [0, 0, 0]),
    ...k.pair('BELLY', [0.32, 0.29, 0.27], [0.2, -0.33, 0.8]),
    k.blob('BELLY', [0.42, 0.24, 0.26], [0, -0.52, 0.66]),
    k.blob('MAIN', [0.42, 0.07, 0.1], [0, 0.34, 0.82], { turn: [-0.35, 0, 0], rough: 0.02, small: true }),
    k.blob('MAIN', [0.3, 0.06, 0.09], [0, 0.48, 0.74], { turn: [-0.55, 0, 0], rough: 0.02, small: true }),
    k.blob('NOSE', [0.15, 0.1, 0.1], [0, -0.13, 1.06], { rough: 0, small: true }),
    ...k.pair('EYES', [0.21, 0.21, 0.13], [0.42, 0.08, 0.77], { turn: [0, 0.42, 0], rough: 0, small: true }),
    ...k.pair('EARS', [0.3, 0.24, 0.08], [0.78, 0.56, 0.22], { turn: [0.2, 0.5, -0.75], rough: 0.02 }),
    k.blob('MAIN', [0.8, 0.44, 0.68], [0, -0.8, -0.04], { rough: 0.05 }),
  ];
  return { parts, fix: anchors(head, 0.08, -0.88) };
}

/** Poodle: chom long xoan tren dinh, tai dai xoan rung hai ben, mom thon. */
function dogPoodle(k) {
  const head = [0.9, 0.86, 0.84];
  const parts = [k.blob('MAIN', head, [0, 0, 0])];
  // Chom long: mot vong cung cac cuc len quanh dinh dau.
  const topknot = [
    [0, 0.82, 0.05, 0.36],
    [0.32, 0.74, 0.18, 0.3],
    [-0.32, 0.74, 0.18, 0.3],
    [0.36, 0.72, -0.22, 0.3],
    [-0.36, 0.72, -0.22, 0.3],
    [0, 0.76, -0.36, 0.32],
    [0, 0.66, 0.4, 0.28],
    [0.18, 1.02, -0.06, 0.26],
    [-0.18, 1.02, -0.06, 0.26],
    [0, 1.08, 0.14, 0.24],
  ];
  for (const [x, y, z, r] of topknot) {
    parts.push(k.blob('MAIN', [r, r * 0.92, r], [x, y, z], { rough: 0.08, small: true }));
  }
  // Tai: chuoi cuc len xoan rung tu hai ben dau xuong qua cam.
  const lobe = [
    [0.86, 0.22, -0.02, 0.26],
    [0.94, -0.06, 0.02, 0.28],
    [0.96, -0.36, 0.04, 0.28],
    [0.92, -0.64, 0.06, 0.26],
    [1.06, -0.2, -0.12, 0.22],
    [1.04, -0.5, -0.1, 0.22],
  ];
  for (const side of [-1, 1]) {
    for (const [x, y, z, r] of lobe) {
      parts.push(k.blob('EARS', [r, r, r * 0.9], [x * side, y, z], { rough: 0.08, small: true }));
    }
  }
  parts.push(
    k.blob('BELLY', [0.3, 0.27, 0.5], [0, -0.26, 0.8], { rough: 0.02 }),
    k.blob('NOSE', [0.12, 0.09, 0.09], [0, -0.16, 1.27], { rough: 0, small: true }),
    ...k.pair('EYES', [0.1, 0.1, 0.07], [0.3, 0.12, 0.76], { turn: [0, 0.35, 0], rough: 0, small: true }),
    k.blob('MAIN', [0.66, 0.42, 0.6], [0, -0.78, -0.06], { rough: 0.08 }),
  );
  return { parts, fix: anchors(head, 0.12, -0.85) };
}

const MODELS = [
  {
    file: 'head-cat-exotic',
    build: catExotic,
    palette: { MAIN: '#e2a465', BELLY: '#fbf6ee', EARS: '#d9965a', EYES: '#7a3d14', NOSE: '#e8a2a0' },
  },
  {
    file: 'head-cat-british',
    build: catBritish,
    palette: { MAIN: '#8e98a4', BELLY: '#b9c1ca', EARS: '#7f8995', EYES: '#d9822b', NOSE: '#6b7480' },
  },
  {
    file: 'head-cat-siamese',
    build: catSiamese,
    palette: { MAIN: '#f1e4cf', BELLY: '#5a4334', EARS: '#4a362a', EYES: '#4f8fd6', NOSE: '#3b2b22' },
  },
  {
    file: 'head-cat-tabby',
    build: catTabby,
    palette: { MAIN: '#d98a3d', BELLY: '#fbf3e6', EARS: '#c97a30', EYES: '#6f9a3a', NOSE: '#e39a96' },
  },
  {
    file: 'head-dog-shiba',
    build: dogShiba,
    palette: { MAIN: '#c8742f', BELLY: '#fbf1e2', EARS: '#b8662a', EYES: '#2b2118', NOSE: '#1f1a17' },
  },
  {
    file: 'head-dog-corgi',
    build: dogCorgi,
    palette: { MAIN: '#d58a3c', BELLY: '#fdf6ec', EARS: '#c87b30', EYES: '#2b2118', NOSE: '#1f1a17' },
  },
  {
    file: 'head-dog-pug',
    build: dogPug,
    palette: { MAIN: '#e3c79e', BELLY: '#3a302a', EARS: '#3a302a', EYES: '#1f1a17', NOSE: '#1a1614' },
  },
  {
    file: 'head-dog-poodle',
    build: dogPoodle,
    palette: { MAIN: '#e6b47e', BELLY: '#efc595', EARS: '#dca56c', EYES: '#2b2118', NOSE: '#2a1f1a' },
  },
];

async function save(scene, name) {
  const out = await new GLTFExporter().parseAsync(scene, { binary: true });
  const path = join(STAGE, `${name}.glb`);
  writeFileSync(path, Buffer.from(out));
  return path;
}

function countVertex(root) {
  let total = 0;
  root.traverse((node) => {
    if (node.isMesh) {
      total += node.geometry.getAttribute('position').count;
    }
  });
  return total;
}

async function main() {
  const only = process.argv[2];
  mkdirSync(STAGE, { recursive: true });
  const staged = [];
  for (const one of MODELS.filter((m) => !only || m.file.includes(only))) {
    for (const [tag, detail] of Object.entries(DETAIL)) {
      const k = kit(detail, one.palette);
      const { parts, fix } = one.build(k);
      const root = new THREE.Group();
      root.name = one.file;
      root.add(...parts, ...fix);
      const name = tag === 'lite' ? one.file : `${one.file}-full`;
      staged.push(await save(root, name));
      console.log(`${name}.glb  ${countVertex(root)} dinh`);
    }
  }
  if (!existsSync(TARGET)) {
    throw new Error(`Khong thay thu muc ${TARGET}`);
  }
  for (const path of staged) {
    copyFileSync(path, join(TARGET, path.split(/[\\/]/).pop()));
  }
  rmSync(STAGE, { recursive: true, force: true });
  console.log(`Da ghi ${staged.length} tep vao ${TARGET}`);
}

main().catch((trouble) => {
  console.error(trouble);
  process.exit(1);
});
