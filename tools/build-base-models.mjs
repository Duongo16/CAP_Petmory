/**
 * Dung bon mau nen dang khoi cach dieu va sau phu kien dung chung (SOW muc 6).
 *
 * Moi bo phan la mot khoi bo tron, gan dung mot trong sau vung vat lieu hop
 * dong yeu cau. Diem neo la nut rong dat ten co dinh; vi tri, huong va do lon
 * cua nut quy dinh luon phu kien gan vao do to bao nhieu, nen mot tep phu kien
 * vua voi ca bon con. Moi mau xuat hai ban: ban nhe cho dien thoai va ban day
 * du cho xuong.
 *
 * Tu dung nen giay phep la CC0, khong can ghi cong.
 * Chay: node tools/build-base-models.mjs
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
const STAGE = join(tmpdir(), `pm-models-${Date.now()}`);

/** Mau mac dinh cua tung vung, nguoi dung doi lai trong studio. */
const ZONE = {
  MAIN: ['PM_FUR_MAIN', '#d9a066'],
  BELLY: ['PM_FUR_SECONDARY', '#f6e7d2'],
  EARS: ['PM_EARS', '#a86b3c'],
  TAIL: ['PM_TAIL', '#c48a52'],
  EYES: ['PM_EYES', '#2b2118'],
  NOSE: ['PM_NOSE', '#3a2a22'],
};

/** Ban nhe it doan bo goc, ban day du bo goc min. */
const DETAIL = { lite: 1, full: 5 };

/** Khoi bo tron ke thua sau nhom mat cua khoi hop; gop lai mot nhom vi moi khoi chi mot vat lieu. */
function solid(geometry) {
  geometry.clearGroups();
  return geometry;
}

function material(name, color) {
  return new THREE.MeshStandardMaterial({ name, color, roughness: 0.92, metalness: 0 });
}

/** Mot bo cong cu dung khoi cho mot ban (nhe hoac day du), voi bang mau mac dinh rieng cua tung con. */
function kit(detail, palette = {}) {
  const made = Object.fromEntries(
    Object.entries(ZONE).map(([key, [name, color]]) => [key, material(name, palette[key] ?? color)]),
  );
  const box = (zone, size, at, turn = [0, 0, 0]) => {
    const [w, h, d] = size;
    const round = Math.min(w, h, d) * 0.28;
    const mesh = new THREE.Mesh(solid(new RoundedBoxGeometry(w, h, d, detail, round)), made[zone]);
    mesh.position.set(...at);
    mesh.rotation.set(...turn);
    mesh.name = `${made[zone].name}_${Math.round(at[0] * 1000)}_${Math.round(at[1] * 1000)}_${Math.round(at[2] * 1000)}`;
    return mesh;
  };
  /** Tai nhon cua meo: hinh chop bon canh. */
  const peak = (zone, radius, height, at, turn = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4, 1), made[zone]);
    mesh.geometry.rotateY(Math.PI / 4);
    mesh.position.set(...at);
    mesh.rotation.set(...turn);
    mesh.name = `${made[zone].name}_peak_${at[0] > 0 ? 'r' : 'l'}`;
    return mesh;
  };
  return { box, peak };
}

/** Nut neo phu kien: vi tri, huong, va do lon ma phu kien don vi se giu. */
function anchor(name, at, scale, turn = [0, 0, 0]) {
  const node = new THREE.Object3D();
  node.name = name;
  node.position.set(...at);
  node.rotation.set(...turn);
  node.scale.setScalar(scale);
  return node;
}

/** Mat, mui, mom dung chung cho cho va meo, dat theo tam dau. */
function face(k, head, opts) {
  const [hx, hy, hz] = head.at;
  const [hw, hh, hd] = head.size;
  const front = hz + hd / 2;
  const parts = [
    k.box('BELLY', [hw * opts.muzzleW, hh * opts.muzzleH, hd * 0.36], [hx, hy - hh * 0.2, front + hd * 0.08]),
    k.box('NOSE', [hw * opts.noseW, hh * 0.16, hd * 0.14], [hx, hy - hh * 0.06, front + hd * 0.25]),
    k.box('EYES', [hw * opts.eyeW, hh * opts.eyeH, hd * 0.08], [hx - hw * 0.25, hy + hh * 0.13, front + 0.001]),
    k.box('EYES', [hw * opts.eyeW, hh * opts.eyeH, hd * 0.08], [hx + hw * 0.25, hy + hh * 0.13, front + 0.001]),
  ];
  return parts;
}

/** Cac diem neo theo dau, co va than; dung chung cho ca bon dang. */
function anchors(head, neck, back) {
  const [hx, hy, hz] = head.at;
  const [hw, hh, hd] = head.size;
  return [
    anchor('PM_ANCHOR_HEAD', [hx, hy + hh / 2, hz], hw),
    anchor('PM_ANCHOR_FACE', [hx, hy + hh * 0.13, hz + hd / 2 + 0.003], hw),
    anchor('PM_ANCHOR_NECK', neck.at, neck.width, neck.turn ?? [0, 0, 0]),
    anchor('PM_ANCHOR_BACK', back.at, back.width, back.turn ?? [0, 0, 0]),
  ];
}

function dogStanding(k) {
  const head = { size: [0.07, 0.064, 0.062], at: [0, 0.128, 0.068] };
  const parts = [
    k.box('MAIN', [0.07, 0.064, 0.12], [0, 0.076, 0]),
    k.box('BELLY', [0.054, 0.012, 0.088], [0, 0.044, 0]),
    k.box('BELLY', [0.05, 0.048, 0.012], [0, 0.078, 0.058]),
    ...[-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [
      k.box('MAIN', [0.022, 0.05, 0.022], [sx * 0.022, 0.03, sz * 0.042]),
      k.box('BELLY', [0.024, 0.011, 0.027], [sx * 0.022, 0.0055, sz * 0.042 + 0.002]),
    ])),
    k.box('MAIN', head.size, head.at),
    ...face(k, head, { muzzleW: 0.58, muzzleH: 0.44, noseW: 0.24, eyeW: 0.15, eyeH: 0.2 }),
    k.box('EARS', [0.016, 0.042, 0.032], [-0.041, 0.126, 0.064], [0, 0, 0.22]),
    k.box('EARS', [0.016, 0.042, 0.032], [0.041, 0.126, 0.064], [0, 0, -0.22]),
    k.box('TAIL', [0.016, 0.016, 0.052], [0, 0.112, -0.074], [0.75, 0, 0]),
  ];
  const fix = anchors(head, { at: [0, 0.1, 0.05], width: 0.062 }, { at: [0, 0.108, -0.005], width: 0.07 });
  return { parts, fix };
}

function dogSitting(k) {
  const head = { size: [0.07, 0.064, 0.062], at: [0, 0.158, 0.03] };
  const parts = [
    k.box('MAIN', [0.07, 0.096, 0.07], [0, 0.074, -0.004], [-0.3, 0, 0]),
    k.box('BELLY', [0.048, 0.07, 0.012], [0, 0.084, 0.033], [-0.3, 0, 0]),
    ...[-1, 1].flatMap((sx) => [
      k.box('MAIN', [0.03, 0.042, 0.064], [sx * 0.03, 0.022, -0.016]),
      k.box('BELLY', [0.026, 0.011, 0.03], [sx * 0.03, 0.0055, 0.022]),
      k.box('MAIN', [0.02, 0.07, 0.02], [sx * 0.017, 0.038, 0.038]),
      k.box('BELLY', [0.023, 0.011, 0.026], [sx * 0.017, 0.0055, 0.042]),
    ]),
    k.box('MAIN', head.size, head.at),
    ...face(k, head, { muzzleW: 0.58, muzzleH: 0.44, noseW: 0.24, eyeW: 0.15, eyeH: 0.2 }),
    k.box('EARS', [0.016, 0.042, 0.032], [-0.041, 0.156, 0.026], [0, 0, 0.22]),
    k.box('EARS', [0.016, 0.042, 0.032], [0.041, 0.156, 0.026], [0, 0, -0.22]),
    k.box('TAIL', [0.016, 0.014, 0.056], [0.03, 0.008, -0.05], [0, 0.7, 0]),
  ];
  const fix = anchors(head, { at: [0, 0.126, 0.026], width: 0.06 }, { at: [0, 0.1, -0.03], width: 0.066, turn: [-0.3, 0, 0] });
  return { parts, fix };
}

function catSitting(k) {
  const head = { size: [0.064, 0.056, 0.054], at: [0, 0.15, 0.022] };
  const parts = [
    k.box('MAIN', [0.06, 0.09, 0.064], [0, 0.07, -0.006], [-0.18, 0, 0]),
    k.box('BELLY', [0.04, 0.066, 0.012], [0, 0.076, 0.028], [-0.18, 0, 0]),
    ...[-1, 1].flatMap((sx) => [
      k.box('MAIN', [0.026, 0.036, 0.056], [sx * 0.026, 0.019, -0.016]),
      k.box('MAIN', [0.017, 0.064, 0.017], [sx * 0.014, 0.034, 0.03]),
      k.box('BELLY', [0.02, 0.01, 0.022], [sx * 0.014, 0.005, 0.034]),
    ]),
    k.box('MAIN', head.size, head.at),
    ...face(k, head, { muzzleW: 0.42, muzzleH: 0.3, noseW: 0.16, eyeW: 0.2, eyeH: 0.26 }),
    k.peak('EARS', 0.016, 0.026, [-0.02, 0.188, 0.02], [0, 0, 0.18]),
    k.peak('EARS', 0.016, 0.026, [0.02, 0.188, 0.02], [0, 0, -0.18]),
    k.box('TAIL', [0.012, 0.012, 0.07], [0.036, 0.006, 0.006], [0, -0.25, 0]),
    k.box('TAIL', [0.012, 0.012, 0.03], [0.02, 0.006, 0.044], [0, -1.2, 0]),
  ];
  const fix = anchors(head, { at: [0, 0.12, 0.018], width: 0.054 }, { at: [0, 0.094, -0.03], width: 0.058, turn: [-0.18, 0, 0] });
  return { parts, fix };
}

function catLying(k) {
  const head = { size: [0.064, 0.056, 0.054], at: [0, 0.07, 0.062] };
  const parts = [
    k.box('MAIN', [0.068, 0.05, 0.11], [0, 0.03, -0.004]),
    k.box('BELLY', [0.046, 0.04, 0.012], [0, 0.032, 0.051]),
    ...[-1, 1].map((sx) => k.box('BELLY', [0.02, 0.013, 0.03], [sx * 0.016, 0.0065, 0.07])),
    k.box('MAIN', head.size, head.at),
    ...face(k, head, { muzzleW: 0.42, muzzleH: 0.3, noseW: 0.16, eyeW: 0.2, eyeH: 0.26 }),
    k.peak('EARS', 0.016, 0.026, [-0.02, 0.108, 0.06], [0, 0, 0.18]),
    k.peak('EARS', 0.016, 0.026, [0.02, 0.108, 0.06], [0, 0, -0.18]),
    k.box('TAIL', [0.012, 0.012, 0.09], [0.042, 0.006, -0.012], [0, 0.08, 0]),
    k.box('TAIL', [0.012, 0.012, 0.03], [0.03, 0.006, 0.042], [0, -0.9, 0]),
  ];
  const fix = anchors(head, { at: [0, 0.046, 0.05], width: 0.06 }, { at: [0, 0.056, -0.01], width: 0.066 });
  return { parts, fix };
}

const MODELS = [
  { file: 'base-dog-standing', build: dogStanding, palette: {} },
  { file: 'base-dog-sitting', build: dogSitting, palette: { MAIN: '#f1f1ee', BELLY: '#ffffff', EARS: '#3b3532', TAIL: '#f1f1ee' } },
  { file: 'base-cat-sitting', build: catSitting, palette: { MAIN: '#9b9a98', BELLY: '#f3f1ec', EARS: '#7b7a78', TAIL: '#8a8987', EYES: '#4b7a3a', NOSE: '#d98c8c' } },
  { file: 'base-cat-lying', build: catLying, palette: { MAIN: '#e8a35c', BELLY: '#fbefe0', EARS: '#cf8a45', TAIL: '#d98f48', EYES: '#6b4a1e', NOSE: '#d98c8c' } },
];

/* Phu kien, dung trong khung don vi: 1 la be ngang cua cho neo. */

function accMaterial(name, color) {
  return material(name, color);
}

function hat(detail) {
  const knit = accMaterial('PM_ACC_MAIN', '#c0392b');
  const trim = accMaterial('PM_ACC_DETAIL', '#f4ecdf');
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8 + detail * 4, 6 + detail * 2, 0, Math.PI * 2, 0, Math.PI / 2), knit);
  cap.scale.set(1, 0.9, 0.95);
  const band = new THREE.Mesh(solid(new RoundedBoxGeometry(0.9, 0.14, 0.86, detail, 0.05)), trim);
  band.position.y = 0.04;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8 + detail * 2, 6 + detail * 2), trim);
  pom.position.y = 0.44;
  g.add(cap, band, pom);
  return g;
}

function bow(detail) {
  const cloth = accMaterial('PM_ACC_MAIN', '#e48aa5');
  const knot = accMaterial('PM_ACC_DETAIL', '#c25478');
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(solid(new RoundedBoxGeometry(0.26, 0.22, 0.12, detail, 0.05)), cloth);
    wing.position.set(side * 0.15, 0, 0);
    wing.rotation.z = side * 0.3;
    g.add(wing);
  }
  const mid = new THREE.Mesh(solid(new RoundedBoxGeometry(0.11, 0.13, 0.14, detail, 0.04)), knot);
  g.add(mid);
  // Cai lech ve mot ben dinh dau, nam ngay tren mat dau chu khong treo len cao.
  g.position.set(0.24, 0.08, 0.12);
  g.rotation.z = -0.35;
  return g;
}

function collar(detail) {
  const strap = accMaterial('PM_ACC_MAIN', '#2e6fb5');
  const tag = accMaterial('PM_ACC_DETAIL', '#e3b341');
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 6 + detail, 12 + detail * 4), strap);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 0.95, 1);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10 + detail * 2), tag);
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, -0.13, 0.58);
  g.add(ring, disc);
  return g;
}

function scarf(detail) {
  const wool = accMaterial('PM_ACC_MAIN', '#5f8f4e');
  const fringe = accMaterial('PM_ACC_DETAIL', '#e9dcc0');
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.13, 6 + detail, 12 + detail * 4), wool);
  ring.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(solid(new RoundedBoxGeometry(0.22, 0.42, 0.1, detail, 0.04)), wool);
  tail.position.set(0.22, -0.22, 0.56);
  tail.rotation.z = 0.15;
  const end = new THREE.Mesh(solid(new RoundedBoxGeometry(0.22, 0.06, 0.1, detail, 0.02)), fringe);
  end.position.set(0.25, -0.44, 0.56);
  end.rotation.z = 0.15;
  g.add(ring, tail, end);
  return g;
}

function glasses(detail) {
  const rim = accMaterial('PM_ACC_MAIN', '#2b2b2b');
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 12 + detail * 4), rim);
    lens.position.set(side * 0.25, 0, 0.02);
    g.add(lens);
  }
  const bridge = new THREE.Mesh(solid(new RoundedBoxGeometry(0.2, 0.035, 0.035, 1, 0.01)), rim);
  bridge.position.set(0, 0.03, 0.02);
  g.add(bridge);
  return g;
}

function cape(detail) {
  const cloth = accMaterial('PM_ACC_MAIN', '#7b4fa0');
  const clasp = accMaterial('PM_ACC_DETAIL', '#e3b341');
  const g = new THREE.Group();
  // Diem neo lung nam ngay mat tren cua than: tam ao om sat do, hai vat ru xuong hai ben.
  const sheet = new THREE.Mesh(solid(new RoundedBoxGeometry(1.12, 0.07, 1.1, detail, 0.03)), cloth);
  sheet.position.set(0, 0.035, -0.05);
  const flapL = new THREE.Mesh(solid(new RoundedBoxGeometry(0.07, 0.42, 1.02, detail, 0.03)), cloth);
  flapL.position.set(-0.56, -0.17, -0.05);
  const flapR = flapL.clone();
  flapR.position.x = 0.56;
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), clasp);
  pin.position.set(0, 0.06, 0.5);
  g.add(sheet, flapL, flapR, pin);
  return g;
}

const ACCESSORIES = [
  { file: 'acc-knit-hat', build: hat },
  { file: 'acc-bow', build: bow },
  { file: 'acc-collar-tag', build: collar },
  { file: 'acc-scarf', build: scarf },
  { file: 'acc-round-glasses', build: glasses },
  { file: 'acc-cape', build: cape },
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
  mkdirSync(STAGE, { recursive: true });
  const staged = [];
  for (const one of MODELS) {
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
  for (const one of ACCESSORIES) {
    const root = new THREE.Group();
    root.name = one.file;
    root.add(one.build(DETAIL.lite + 1));
    staged.push(await save(root, one.file));
    console.log(`${one.file}.glb  ${countVertex(root)} dinh`);
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
