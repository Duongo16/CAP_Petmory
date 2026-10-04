import * as THREE from 'three';
import { StandDecoration, StandToneOption, StandView, STAND_DECORATION_MAX } from './stand-options';

/** Mau cua do trang tri. Day la mau tren mo hinh, khong phai mau giao dien. */
const DECOR_COLOR = {
  stem: '#7fae6e',
  petals: ['#f4a7b9', '#fff3e2', '#c9b6e4'],
  flowerHeart: '#f6c453',
  heart: '#e86a7f',
  bone: '#f3e6cf',
  fish: '#8fb8d8',
  fishFin: '#6d9cc2',
  eye: '#2b2420',
  yarn: '#e58f65',
  yarnLine: '#c96f48',
  stalk: '#f5ead6',
  cap: '#e25b4a',
  dot: '#fff8ee',
};

const FONT_HAND = '"Patrick Hand", "Quicksand", "Be Vietnam Pro", cursive';

/** Chieu cao than de, tinh tren mo hinh da chuan hoa ve mot don vi. */
const STAND_HEIGHT = 0.12;
const SQUARE_BEVEL = 0.014;

/**
 * Dung de trung bay bang go cho be: than de, chu khac o mat truoc va do
 * trang tri dat quanh chan be.
 *
 * Than de va do trang tri chi dung lai khi doi hinh, mau go hay do trang tri.
 * Go chu thi chi ve lai lop chu, de go tung phim van muot.
 */
export class StandBuilder {
  readonly group = new THREE.Group();

  private body: THREE.Object3D | null = null;
  private decal: THREE.Mesh | null = null;
  private decalTexture: THREE.CanvasTexture | null = null;
  private keyBody = '';
  private keyText = '';
  private view: StandView | null = null;
  private radius = 0.4;

  constructor() {
    this.group.name = 'pm-stand';
  }

  /**
   * Ve lai de cho dung voi lua chon va voi khung bao cua be.
   * Tra ve false khi khong co de, de ben goi biet khong can doi khung hinh.
   */
  update(view: StandView | null, petBox: THREE.Box3): boolean {
    this.view = view;
    if (!view) {
      this.clear();
      return false;
    }
    const size = petBox.getSize(new THREE.Vector3());
    const keyBody = [
      view.shape,
      view.tone.code,
      view.decorations.join('+'),
      size.x.toFixed(3),
      size.z.toFixed(3),
      petBox.min.y.toFixed(3),
    ].join('|');
    if (keyBody !== this.keyBody) {
      this.buildBody(view, petBox);
      this.keyBody = keyBody;
    }
    const keyText = `${view.name}|${view.line}|${view.tone.code}`;
    if (keyText !== this.keyText) {
      this.keyText = keyText;
      this.drawText(view);
    }
    return true;
  }

  dispose(): void {
    this.clear();
  }

  private clear(): void {
    this.keyBody = '';
    this.keyText = '';
    if (this.body) {
      this.group.remove(this.body);
      disposeTree(this.body);
      this.body = null;
      this.decal = null;
    }
    this.decalTexture?.dispose();
    this.decalTexture = null;
  }

  private buildBody(view: StandView, petBox: THREE.Box3): void {
    this.clear();
    const size = petBox.getSize(new THREE.Vector3());
    const center = petBox.getCenter(new THREE.Vector3());
    // Du rong de bon goc khung bao cua be van nam tren de, chua cho do trang tri.
    this.radius = Math.max(0.28, Math.max(size.x, size.z) / 2 + 0.035);

    const root = new THREE.Group();
    root.position.set(center.x, petBox.min.y - STAND_HEIGHT, center.z);

    const wood = makeWoodMaterial(view.tone, view.shape === 'ROUND');
    const shapeMesh = view.shape === 'ROUND' ? this.roundBody(wood) : this.squareBody(wood);
    root.add(shapeMesh);

    this.decal = view.shape === 'ROUND' ? this.roundDecal() : this.squareDecal();
    root.add(this.decal);

    const slots = this.decorationSlots(size, center, root.position);
    view.decorations.slice(0, STAND_DECORATION_MAX).forEach((code, i) => {
      const item = makeDecoration(code);
      item.scale.setScalar(Math.min(1.4, this.radius / 0.45));
      item.position.copy(slots[i]);
      item.rotation.y = slots[i].x > 0 ? -0.5 : 0.5;
      root.add(item);
    });

    this.body = root;
    this.group.add(root);
  }

  private roundBody(wood: THREE.Material): THREE.Mesh {
    const r = this.radius;
    const h = STAND_HEIGHT;
    const bevel = 0.018;
    // Mat cat theo chieu doc cua de: day, canh duoi vat nhe, than thang, mep tren bo tron.
    const profile = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - bevel * 0.6, 0),
      new THREE.Vector2(r, bevel * 0.6),
      new THREE.Vector2(r, h - bevel),
      new THREE.Vector2(r - bevel * 0.3, h - bevel * 0.3),
      new THREE.Vector2(r - bevel, h),
      new THREE.Vector2(0.0001, h),
    ];
    const geometry = new THREE.LatheGeometry(profile, 72);
    return new THREE.Mesh(geometry, wood);
  }

  private squareBody(wood: THREE.Material): THREE.Mesh {
    const half = this.squareHalf();
    const corner = half * 0.18;
    const shape = new THREE.Shape();
    shape.moveTo(-half + corner, -half);
    shape.lineTo(half - corner, -half);
    shape.quadraticCurveTo(half, -half, half, -half + corner);
    shape.lineTo(half, half - corner);
    shape.quadraticCurveTo(half, half, half - corner, half);
    shape.lineTo(-half + corner, half);
    shape.quadraticCurveTo(-half, half, -half, half - corner);
    shape.lineTo(-half, -half + corner);
    shape.quadraticCurveTo(-half, -half, -half + corner, -half);
    const bevel = SQUARE_BEVEL;
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: STAND_HEIGHT - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 8,
    });
    // Hinh dun theo truc sau, xoay lai cho dung tren mat phang ngang.
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bevel, 0);
    const mesh = new THREE.Mesh(geometry, wood);
    return mesh;
  }

  /** Lop chu cong om theo mat truoc cua de tron. */
  private roundDecal(): THREE.Mesh {
    const arc = 1.25;
    const geometry = new THREE.CylinderGeometry(
      this.radius + 0.0015,
      this.radius + 0.0015,
      STAND_HEIGHT * 0.72,
      32,
      1,
      true,
      -arc / 2,
      arc,
    );
    geometry.translate(0, STAND_HEIGHT / 2, 0);
    return new THREE.Mesh(geometry, this.decalMaterial());
  }

  /** Lop chu phang dan len mat truoc cua de vuong. */
  private squareDecal(): THREE.Mesh {
    const half = this.squareHalf();
    const geometry = new THREE.PlaneGeometry(half * 1.7, STAND_HEIGHT * 0.6);
    const mesh = new THREE.Mesh(geometry, this.decalMaterial());
    // Lop vat canh day mat truoc ra them mot doan, chu phai nam ngoai doan do.
    mesh.position.set(0, STAND_HEIGHT / 2, half + SQUARE_BEVEL + 0.0015);
    return mesh;
  }

  /** De vuong nho hon de tron mot chut, vi goc vuong da chiem them cho. */
  private squareHalf(): number {
    return this.radius * 0.82;
  }

  private decalMaterial(): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    this.decalTexture = new THREE.CanvasTexture(canvas);
    this.decalTexture.colorSpace = THREE.SRGBColorSpace;
    this.decalTexture.anisotropy = 4;
    return new THREE.MeshStandardMaterial({
      map: this.decalTexture,
      transparent: true,
      roughness: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  }

  /** Viet ten va dong phu theo kieu khac chim vao go: net toi, vien sang ben duoi. */
  private drawText(view: StandView): void {
    const texture = this.decalTexture;
    if (!texture) {
      return;
    }
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Go sang thi khac chu toi, go toi thi khac chu sang, de chu luon doc duoc.
    const wood = new THREE.Color(view.tone.hex);
    const dark = wood.getHSL({ h: 0, s: 0, l: 0 }).l < 0.35;
    const ink = (dark ? wood.clone().lerp(new THREE.Color('#fff4e0'), 0.7) : wood.clone().multiplyScalar(0.42))
      .getStyle(THREE.SRGBColorSpace);
    const shine = (dark ? wood.clone().multiplyScalar(0.55) : wood.clone().lerp(new THREE.Color('#ffffff'), 0.45))
      .getStyle(THREE.SRGBColorSpace);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines: { text: string; size: number; y: number }[] = [];
    if (view.name && view.line) {
      lines.push({ text: view.name, size: 128, y: 96 }, { text: view.line, size: 64, y: 200 });
    } else if (view.name || view.line) {
      lines.push({ text: view.name || view.line, size: 140, y: 128 });
    }
    for (const one of lines) {
      let size = one.size;
      ctx.font = `${size}px ${FONT_HAND}`;
      while (ctx.measureText(one.text).width > canvas.width * 0.92 && size > 24) {
        size -= 6;
        ctx.font = `${size}px ${FONT_HAND}`;
      }
      ctx.fillStyle = shine;
      ctx.fillText(one.text, canvas.width / 2, one.y + 3);
      ctx.fillStyle = ink;
      ctx.fillText(one.text, canvas.width / 2, one.y);
    }
    texture.needsUpdate = true;

    // Phong chu viet tay co the chua tai xong o lan ve dau, nen ve lai khi tai xong.
    const fonts = document.fonts;
    if (fonts && !fonts.check(`64px ${FONT_HAND}`)) {
      fonts.load(`64px ${FONT_HAND}`).then(() => {
        if (this.view === view && this.decalTexture === texture) {
          this.keyText = '';
          this.drawText(view);
        }
      }, () => undefined);
    }
  }

  /** Bon cho tren mat de, tranh phan chan be dung. */
  private decorationSlots(size: THREE.Vector3, center: THREE.Vector3, origin: THREE.Vector3): THREE.Vector3[] {
    const ring = this.radius * 0.78;
    const angles = [Math.PI * 0.2, Math.PI * 0.8, -Math.PI * 0.2, -Math.PI * 0.8];
    const halfX = size.x / 2 + 0.02;
    const halfZ = size.z / 2 + 0.02;
    return angles.map((angle) => {
      let r = ring;
      let x = Math.cos(angle) * r;
      let z = Math.sin(angle) * r;
      // Day ra ngoai cho den khi khong cham khung bao cua be, nhung khong qua mep de.
      while (Math.abs(x + origin.x - center.x) < halfX && Math.abs(z + origin.z - center.z) < halfZ && r < this.radius * 0.9) {
        r += 0.01;
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
      }
      return new THREE.Vector3(x, STAND_HEIGHT, z);
    });
  }
}

/** Van go ve bang tay tren mot tam anh, nhuom theo mau go da chon. */
function makeWoodMaterial(tone: StandToneOption, ringsOnTop: boolean): THREE.MeshStandardMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const base = new THREE.Color(tone.hex);
  if (ctx) {
    ctx.fillStyle = base.getStyle(THREE.SRGBColorSpace);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const dark = base.clone().multiplyScalar(0.72).getStyle(THREE.SRGBColorSpace);
    const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.25).getStyle(THREE.SRGBColorSpace);
    const strength = tone.painted ? 0.12 : 0.42;
    // Hat ngau nhien co dinh, de lan nao ve cung ra mot van go.
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 70; i += 1) {
      const y = random() * canvas.height;
      const wave = 2 + random() * 6;
      const phase = random() * Math.PI * 2;
      ctx.strokeStyle = random() > 0.35 ? dark : light;
      ctx.globalAlpha = strength * (0.35 + random() * 0.65);
      ctx.lineWidth = 1 + random() * 3;
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 16) {
        const yy = y + Math.sin(x / 90 + phase) * wave;
        if (x === 0) {
          ctx.moveTo(x, yy);
        } else {
          ctx.lineTo(x, yy);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (!ringsOnTop) {
    texture.repeat.set(1.6, 1.6);
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: tone.painted ? 0.7 : 0.55,
    metalness: 0,
  });
}

function plain(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
}

function heartShape(size: number): THREE.Shape {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s * 0.9);
  shape.bezierCurveTo(-s * 0.2, -s * 0.6, -s, -s * 0.25, -s, s * 0.2);
  shape.bezierCurveTo(-s, s * 0.75, -s * 0.35, s * 0.9, 0, s * 0.45);
  shape.bezierCurveTo(s * 0.35, s * 0.9, s, s * 0.75, s, s * 0.2);
  shape.bezierCurveTo(s, -s * 0.25, s * 0.2, -s * 0.6, 0, -s * 0.9);
  return shape;
}

/** Tung mon trang tri, dung tu hinh co ban, dat goc tai mat de. */
function makeDecoration(code: StandDecoration): THREE.Group {
  const g = new THREE.Group();
  g.name = `pm-decor-${code}`;
  switch (code) {
    case 'FLOWERS':
      [[-0.022, 0.06, 0], [0.02, 0.045, 0.012], [0.004, 0.035, -0.022]].forEach(([x, h, z], i) => {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, h, 6), plain(DECOR_COLOR.stem));
        stem.position.set(x, h / 2, z);
        g.add(stem);
        const petal = plain(DECOR_COLOR.petals[i % DECOR_COLOR.petals.length]);
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI * 2;
          const p = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), petal);
          p.scale.set(1, 0.55, 1);
          p.position.set(x + Math.cos(a) * 0.013, h, z + Math.sin(a) * 0.013);
          g.add(p);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), plain(DECOR_COLOR.flowerHeart));
        heart.position.set(x, h + 0.004, z);
        g.add(heart);
      });
      break;
    case 'HEART': {
      const geometry = new THREE.ExtrudeGeometry(heartShape(0.035), {
        depth: 0.014,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 4,
        curveSegments: 16,
      });
      geometry.center();
      const heart = new THREE.Mesh(geometry, plain(DECOR_COLOR.heart));
      heart.position.y = 0.04;
      heart.rotation.z = 0.15;
      g.add(heart);
      break;
    }
    case 'BONE': {
      const material = plain(DECOR_COLOR.bone);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 12), material);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.y = 0.012;
      g.add(shaft);
      for (const x of [-0.037, 0.037]) {
        for (const z of [-0.009, 0.009]) {
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), material);
          knob.position.set(x, 0.012, z);
          g.add(knob);
        }
      }
      break;
    }
    case 'FISH': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), plain(DECOR_COLOR.fish));
      body.scale.set(1.5, 0.85, 0.45);
      body.position.y = 0.03;
      g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.034, 3), plain(DECOR_COLOR.fishFin));
      tail.rotation.z = Math.PI / 2;
      tail.scale.set(1, 1, 0.4);
      tail.position.set(-0.054, 0.03, 0);
      g.add(tail);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), plain(DECOR_COLOR.eye));
      eye.position.set(0.03, 0.036, 0.012);
      g.add(eye);
      break;
    }
    case 'YARN_BALL': {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 16), plain(DECOR_COLOR.yarn));
      ball.position.y = 0.03;
      g.add(ball);
      const line = plain(DECOR_COLOR.yarnLine);
      [[0.3, 0.2], [1.2, -0.4], [-0.6, 1.1]].forEach(([rx, rz]) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0295, 0.0022, 6, 40), line);
        ring.rotation.set(rx, 0, rz);
        ring.position.y = 0.03;
        g.add(ring);
      });
      const thread = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.02, 0.01, 0.02),
        new THREE.Vector3(0.05, 0.003, 0.04),
        new THREE.Vector3(0.07, 0.003, 0.02),
        new THREE.Vector3(0.09, 0.003, 0.045),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(thread, 24, 0.0022, 6), line));
      break;
    }
    case 'MUSHROOM': {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.032, 12), plain(DECOR_COLOR.stalk));
      stalk.position.y = 0.016;
      g.add(stalk);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        plain(DECOR_COLOR.cap),
      );
      cap.scale.set(1, 0.8, 1);
      cap.position.y = 0.03;
      g.add(cap);
      const dot = plain(DECOR_COLOR.dot);
      [[0.012, 0.012], [-0.014, 0.006], [0.002, -0.016], [-0.004, 0.018]].forEach(([x, z]) => {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 6), dot);
        const y = 0.03 + Math.sqrt(Math.max(0, 0.03 * 0.03 - x * x - z * z)) * 0.8;
        spot.position.set(x, y, z);
        g.add(spot);
      });
      break;
    }
  }
  return g;
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }
    node.geometry.dispose();
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of list) {
      const standard = material as THREE.MeshStandardMaterial;
      standard.map?.dispose();
      standard.dispose();
    }
  });
}
