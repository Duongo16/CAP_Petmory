import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Painter, PaintMode, PaintState } from './painter';
import { StandBuilder } from './stand-builder';
import { StandView } from './stand-options';

/** Ten nut neo trong tep mo hinh ung voi tung diem neo cua phu kien. */
export const ANCHOR_NODE: Record<'HEAD' | 'FACE' | 'NECK' | 'BACK', string> = {
  HEAD: 'PM_ANCHOR_HEAD',
  FACE: 'PM_ANCHOR_FACE',
  NECK: 'PM_ANCHOR_NECK',
  BACK: 'PM_ANCHOR_BACK',
};

/** Mot phu kien can gan: ma, duong dan tep va ten nut neo trong mau. */
export interface AccessoryMount {
  code: string;
  path: string;
  anchor: string;
}

/** Six standard angles for viewing and for capturing stills for the workshop. */
export type StandardAngle = 'FRONT' | 'LEFT' | 'RIGHT' | 'BACK' | 'TOP' | 'ISO';

export const ANGLES_PREPARE: StandardAngle[] = ['FRONT', 'LEFT', 'RIGHT', 'BACK', 'TOP', 'ISO'];

/** Camera direction for each angle, scaled by the model's bounding radius. */
const ANGLE_DIRECTION: Record<StandardAngle, THREE.Vector3> = {
  FRONT: new THREE.Vector3(0, 0.25, 1),
  LEFT: new THREE.Vector3(-1, 0.25, 0),
  RIGHT: new THREE.Vector3(1, 0.25, 0),
  BACK: new THREE.Vector3(0, 0.25, -1),
  TOP: new THREE.Vector3(0, 1, 0.001),
  ISO: new THREE.Vector3(0.9, 0.6, 0.9),
};

/** Khoang cach camera, tinh theo ban kinh mo hinh. */
const FRAME_DISTANCE = 2.85;
/** Do ha diem nhin, tinh theo ban kinh, de con vat nam cao hon trong khung. */
const FRAME_LIFT = 0.14;

export interface MaterialZone {
  /** Zone name read from the model file itself. */
  name: string;
  /** The current colour as a six-character string. */
  colorCurrent: string;
}

export interface ResultLoadModel {
  zone: MaterialZone[];
  countVertex: number;
}

export interface EngineOptions {
  /** Canvas background colour, following the interface's light or dark mode. */
  baseModel: string;
  /** On a weak device, lower the pixel ratio to keep the frame rate up. */
  maxPixelRatio: number;
}

/**
 * A Three.js wrapper. It does not depend on Angular, so it can be reused and tested
 * on its own. The render loop runs on the browser's own animation callback
 * and touches no signals,
 * so it never triggers the framework's change detection.
 */
export class Engine3d {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly resizeObserver: ResizeObserver;

  private angle: THREE.Group | null = null;
  private painter: Painter | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private materialByZone = new Map<string, THREE.MeshStandardMaterial[]>();
  private attachedAccessories = new Map<string, THREE.Object3D>();
  private wantedAccessories = new Set<string>();
  private readonly measureGroup = new THREE.Group();
  private measurePoints: THREE.Vector3[] = [];
  private radius = 1;
  private modelCenter = new THREE.Vector3();
  private frameHandle = 0;
  private disposed = false;
  private readonly stand = new StandBuilder();
  private standView: StandView | null = null;

  constructor(
    private readonly wrap: HTMLElement,
    options: EngineOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
            // Enabled so the canvas can be read back when capturing the six standard angles.
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(options.baseModel);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(2, 1.2, 2.6);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 20;

    this.addLights();
    this.scene.add(this.stand.group);
    this.scene.add(this.measureGroup);

    wrap.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.setAttribute('aria-label', 'Mo hinh ba chieu');

    this.resizeObserver = new ResizeObserver(() => this.updateDimensions());
    this.resizeObserver.observe(wrap);
    this.updateDimensions();
    this.startRenderLoop();
  }

  /** Loads a new model, replacing the one on screen if there is one. */
  /**
   * Nap mot mo hinh moi, thay cho mo hinh dang hien neu co.
   *
   * Moi tac gia ve con vat quay mot huong, nen ban khai ghi them goc xoay de
   * con nao cung quay mat ve phia truoc.
   */
  async loadModel(path: string, rotateYDegrees = 0): Promise<ResultLoadModel> {
    const gltf = await this.loader.loadAsync(path);
    if (this.disposed) {
      return { zone: [], countVertex: 0 };
    }

    this.disposeOldModel();
    this.angle = gltf.scene;
    this.scene.add(this.angle);

        // Bake the texture colours into vertex colours so the model can be painted directly.
    this.painter = new Painter(this.angle);
    this.groupMaterialByZone(this.angle);
    this.refreshBounds(this.angle);
    this.angle.rotation.y = THREE.MathUtils.degToRad(rotateYDegrees);
    this.angle.updateMatrixWorld(true);
    const countVertex = this.countVertex(this.angle);
    this.centerAndNormalise(this.angle);
    this.refreshStand();
    this.setAngle('ISO');

    const zone: MaterialZone[] = [...this.materialByZone.entries()].map(([name, list]) => ({
      name,
      colorCurrent: `#${list[0].color.getHexString()}`,
    }));

    return { zone, countVertex };
  }

  /**
   * To mau cho mot hoac nhieu vung cung luc.
   *
   * Sau khi lop to mau da nhan viec, mau nam o tung dinh chu khong o mang vat
   * lieu nua, nen doi mau mang vat lieu se khong con tac dung gi. Duong nay
   * chon dung cach con tac dung, va tra ve so mat da to de ben goi biet ban do
   * vung co khop voi tep mo hinh dang mo hay khong.
   */
  applyZoneColors(colorByZone: Record<string, string>): number {
    if (this.painter?.ready) {
      return this.painter.paintZones(colorByZone);
    }
    let touched = 0;
    for (const [zone, hex] of Object.entries(colorByZone)) {
      const list = this.materialByZone.get(zone);
      if (!list) {
        continue;
      }
      for (const material of list) {
        material.color.set(hex);
        touched += 1;
      }
    }
    return touched;
  }

  /** Recolours one zone. Touches only the material, and never rebuilds the model. */
  changeColorZone(nameZone: string, hexColor: string): void {
        // Once the model is on vertex colours the material colour is only a multiplier,
        // so changing it here would tint the whole model. Skip it.
    if (this.painter?.ready) {
      return;
    }
    const list = this.materialByZone.get(nameZone);
    if (!list) {
      return;
    }
    for (const material of list) {
      material.color.set(hexColor);
    }
  }

  /** Moves the camera to a standard angle. */
  setAngle(angle: StandardAngle): void {
    const direction = ANGLE_DIRECTION[angle].clone().normalize();
    this.aimCamera(direction);
  }

  /**
   * Dat camera theo mot huong, nhin vao diem hoi thap hon tam mo hinh.
   *
   * Mep duoi khung xem co cac nut noi, nen day con vat len cao mot chut va lui
   * camera ra them, de dang cao nhu meo ngoi khong bi che mat phan chan.
   */
  private aimCamera(direction: THREE.Vector3): void {
    const target = this.modelCenter.clone();
    target.y -= this.radius * FRAME_LIFT;
    this.camera.position.copy(target).addScaledVector(direction, this.radius * FRAME_DISTANCE);
    this.controls.target.copy(target);
    this.controls.update();
  }

  /**
   * Attaches an accessory to the model at a given anchor point.
   *
   * Mau khong co diem neo do thi khong gan, thay vi treo phu kien lo lung o
   * goc mo hinh. Diem neo mang san do lon, nen phu kien vua voi tung con.
   */
  async attachAccessory(code: string, path: string, anchorName: string): Promise<boolean> {
    const gltf = await this.loader.loadAsync(path);
    if (this.disposed || !this.angle || !this.wantedAccessories.has(code)) {
      this.disposeTree(gltf.scene);
      return false;
    }
    const mountPoint = this.angle.getObjectByName(anchorName);
    if (!mountPoint) {
      this.disposeTree(gltf.scene);
      return false;
    }
    this.detachAccessory(code);
    mountPoint.add(gltf.scene);
    this.attachedAccessories.set(code, gltf.scene);
    return true;
  }

  /** Gan va go phu kien cho khop dung danh sach dang chon. */
  syncAccessories(list: AccessoryMount[]): void {
    this.wantedAccessories = new Set(list.map((one) => one.code));
    for (const code of Array.from(this.attachedAccessories.keys())) {
      if (!this.wantedAccessories.has(code)) {
        this.detachAccessory(code);
      }
    }
    for (const one of list) {
      if (!this.attachedAccessories.has(one.code)) {
        void this.attachAccessory(one.code, one.path, one.anchor);
      }
    }
  }

  detachAccessory(code: string): void {
    const object = this.attachedAccessories.get(code);
    if (!object) {
      return;
    }
    object.removeFromParent();
    this.disposeTree(object);
    this.attachedAccessories.delete(code);
  }

  /** Captures stills at the six standard angles, for the production file and the design snapshot. */
  captureSixAngles(edgePhoto = 800): Record<StandardAngle, string> {
    const previousPosition = this.camera.position.clone();
    const previousTarget = this.controls.target.clone();
    const dimensionsOld = new THREE.Vector2();
    this.renderer.getSize(dimensionsOld);

    this.renderer.setSize(edgePhoto, edgePhoto, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    const result = {} as Record<StandardAngle, string>;
    for (const angle of ANGLES_PREPARE) {
      this.setAngle(angle);
      this.renderer.render(this.scene, this.camera);
      result[angle] = this.renderer.domElement.toDataURL('image/png');
    }

    this.renderer.setSize(dimensionsOld.x, dimensionsOld.y, false);
    this.camera.position.copy(previousPosition);
    this.controls.target.copy(previousTarget);
    this.updateDimensions();
    return result;
  }

  /**
   * Paints at a point on the canvas. Coordinates are ratios from 0 to 1 relative to
   * the canvas size, so they do not depend on screen resolution.
   */
  /** Kich thuoc khung bao cua be (khong tinh de), theo don vi trong canh. */
  modelSize(): { x: number; y: number; z: number } {
    if (!this.angle) {
      return { x: 0, y: 0, z: 0 };
    }
    const size = new THREE.Box3().setFromObject(this.angle).getSize(new THREE.Vector3());
    return { x: size.x, y: size.y, z: size.z };
  }

  /**
   * Chon mot diem tren be de do, them dau cham va noi voi diem truoc.
   *
   * Tra ve khoang cach giua hai diem gan nhat theo don vi trong canh, hoac rong
   * khi moi co mot diem. Diem thu ba bat dau mot lan do moi.
   */
  measureAt(ratioX: number, ratioY: number): number | null {
    if (!this.angle) {
      return null;
    }
    this.raycaster.setFromCamera(new THREE.Vector2(ratioX * 2 - 1, -(ratioY * 2 - 1)), this.camera);
    const hit = this.raycaster.intersectObject(this.angle, true)[0];
    if (!hit) {
      return null;
    }
    if (this.measurePoints.length >= 2) {
      this.clearMeasure();
    }
    this.measurePoints.push(hit.point.clone());
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius * 0.012, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#d1495b', depthTest: false }),
    );
    dot.position.copy(hit.point);
    dot.renderOrder = 10;
    this.measureGroup.add(dot);
    if (this.measurePoints.length < 2) {
      return null;
    }
    const [from, to] = this.measurePoints;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([from, to]),
      new THREE.LineBasicMaterial({ color: '#d1495b', depthTest: false }),
    );
    line.renderOrder = 10;
    this.measureGroup.add(line);
    return from.distanceTo(to);
  }

  clearMeasure(): void {
    this.measurePoints = [];
    for (const child of [...this.measureGroup.children]) {
      child.removeFromParent();
      this.disposeTree(child);
    }
  }

  paintAtPoint(ratioX: number, ratioY: number, color: string, mode: PaintMode, radius: number): boolean {
    if (!this.painter?.ready) {
      return false;
    }
    this.raycaster.setFromCamera(
      new THREE.Vector2(ratioX * 2 - 1, -(ratioY * 2 - 1)),
      this.camera,
    );
    return this.painter.paint(this.raycaster, color, mode, radius);
  }

  undoPaint(): boolean {
    return this.painter?.undo() ?? false;
  }

  /** So mat cua tung mau theo vat lieu, de biet moi vung dang mang mau gi. */
  colorCountByMaterial(): Record<string, Record<string, number>> {
    return this.painter?.colorCountByMaterial() ?? {};
  }

  /** Exports the current colour of every face so a draft can be saved. */
  exportStatusPaint(): PaintState[] {
    return this.painter?.exportStatus() ?? [];
  }

  /** Reloads saved colours. Returns how many meshes were loaded. */
  loadStatusPaint(status: PaintState[]): number {
    return this.painter?.loadStatus(status) ?? 0;
  }

  paintAll(color: string): void {
    this.painter?.paintAll(color);
  }

  get canPaint(): boolean {
    return this.painter?.ready ?? false;
  }

  /** Turns the slow auto-rotate on or off for an all-round view. */
  setAutoRotate(toggle: boolean): void {
    this.controls.autoRotate = toggle;
    this.controls.autoRotateSpeed = 1.4;
  }

  changeBaseModel(color: string): void {
    this.scene.background = new THREE.Color(color);
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.stand.dispose();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.disposeOldModel();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const primary = new THREE.DirectionalLight(0xffffff, 2.2);
    primary.position.set(3, 5, 4);
    this.scene.add(primary);
    const overlay = new THREE.DirectionalLight(0xffffff, 0.8);
    overlay.position.set(-4, 2, -3);
    this.scene.add(overlay);
  }

  /**
   * Collects materials by zone name. Materials are cloned so recolouring one model
   * does not affect other models sharing the loader's cache.
   */
  private groupMaterialByZone(angle: THREE.Object3D): void {
    this.materialByZone = new Map();
    angle.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const cloned = materials.map((material) => {
        const copy = (material as THREE.MeshStandardMaterial).clone();
        const name = copy.name || 'unnamed';
        const existing = this.materialByZone.get(name) ?? [];
        existing.push(copy);
        this.materialByZone.set(name, existing);
        return copy;
      });
      node.material = Array.isArray(node.material) ? cloned : cloned[0];
    });
  }

  /** Dat, doi hoac bo de trung bay duoi chan be. */
  setStand(view: StandView | null): void {
    this.standView = view;
    if (!this.angle) {
      return;
    }
    const before = this.radius;
    this.refreshStand();
    // Chi dua camera ra lai khi khung hinh doi han, de khong mat muc phong to cua nguoi dung.
    if (Math.abs(this.radius - before) > 0.02) {
      this.aimCamera(this.camera.position.clone().sub(this.controls.target).normalize());
    }
  }

  /** Tinh lai khung bao tu dinh that, vi khung bao ghi san trong tep co khi sai ma khung nay dung de can co mo hinh. */
  private refreshBounds(angle: THREE.Object3D): void {
    angle.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.computeBoundingBox();
        node.geometry.computeBoundingSphere();
      }
    });
  }

  /** Dung lai de theo khung bao hien tai cua be, roi tinh lai tam va ban kinh khung hinh. */
  private refreshStand(): void {
    if (!this.angle) {
      return;
    }
    const petBox = new THREE.Box3().setFromObject(this.angle);
    const hasStand = this.stand.update(this.standView, petBox);
    const box = hasStand ? petBox.clone().union(new THREE.Box3().setFromObject(this.stand.group)) : petBox;
    box.getCenter(this.modelCenter);
    this.radius = box.getSize(new THREE.Vector3()).length() / 2 || 1;
  }

  private countVertex(angle: THREE.Object3D): number {
    let total = 0;
    angle.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        total += node.geometry.getAttribute('position')?.count ?? 0;
      }
    });
    return total;
  }

  /** Centres the model in the frame and normalises its size, so every model looks the same. */
  private centerAndNormalise(angle: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(angle);
    const dimensions = box.getSize(new THREE.Vector3());
    const longestEdge = Math.max(dimensions.x, dimensions.y, dimensions.z) || 1;
    const ratio = 1 / longestEdge;
    angle.scale.setScalar(ratio);

    const bounds = new THREE.Box3().setFromObject(angle);
    const center = bounds.getCenter(new THREE.Vector3());
    angle.position.sub(center);

    this.modelCenter.set(0, 0, 0);
    this.radius = bounds.getSize(new THREE.Vector3()).length() / 2 || 1;
  }

  private disposeOldModel(): void {
    this.clearMeasure();
        // The list has to be copied before anything is detached, because each removal
        // deletes an entry from the very collection being walked.
    const codes = Array.from(this.attachedAccessories.keys());
    for (const code of codes) {
      this.detachAccessory(code);
    }
    if (!this.angle) {
      return;
    }
    this.angle.removeFromParent();
    this.disposeTree(this.angle);
    this.angle = null;
    this.painter = null;
    this.materialByZone.clear();
  }

  private disposeTree(angle: THREE.Object3D): void {
    angle.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }
      node.geometry.dispose();
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of list) {
        (material as THREE.Material).dispose();
      }
    });
  }

  private updateDimensions(): void {
    const width = this.wrap.clientWidth || 1;
    const height = this.wrap.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private startRenderLoop(): void {
    const draw = (): void => {
      if (this.disposed) {
        return;
      }
      this.frameHandle = requestAnimationFrame(draw);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    draw();
  }
}
