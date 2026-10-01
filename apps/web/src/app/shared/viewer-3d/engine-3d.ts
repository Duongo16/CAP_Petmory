import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Painter, PaintMode, PaintState } from './painter';
import { BodyShape, bodyShapeOf } from './body-shape';

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
  private bonesByName = new Map<string, THREE.Object3D>();
  private originalBoneScale = new Map<string, THREE.Vector3>();
  private materialByZone = new Map<string, THREE.MeshStandardMaterial[]>();
  private attachedAccessories = new Map<string, THREE.Object3D>();
  private shapeWanted = '';
  private radius = 1;
  private modelCenter = new THREE.Vector3();
  private frameHandle = 0;
  private disposed = false;

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
  async loadModel(path: string): Promise<ResultLoadModel> {
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
    this.collectBones(this.angle);
    this.applyBodyShape(this.shapeWanted);
    const countVertex = this.countVertex(this.angle);
    this.centerAndNormalise(this.angle);
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
    const distance = this.radius * 2.6;
    this.camera.position.copy(this.modelCenter).addScaledVector(direction, distance);
    this.controls.target.copy(this.modelCenter);
    this.controls.update();
  }

  /** Attaches an accessory to the model at a given anchor point. */
  async attachAccessory(code: string, path: string, anchorName?: string): Promise<boolean> {
    const gltf = await this.loader.loadAsync(path);
    if (this.disposed || !this.angle) {
      return false;
    }
    this.detachAccessory(code);
    const mountPoint = anchorName ? this.angle.getObjectByName(anchorName) : null;
    const target = mountPoint ?? this.angle;
    target.add(gltf.scene);
    this.attachedAccessories.set(code, gltf.scene);
    return mountPoint !== null;
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

  /**
   * Nan lai ti le cac phan than cua mo hinh.
   *
   * Moi lan deu tinh tu ti le goc da nho luc doc tep, nen goi bao nhieu lan
   * cung ra cung mot ket qua, va ten dang rong thi tra ve nguyen dang goc.
   *
   * Chi nhung ten xuong co that trong tep moi duoc dung. Ten khong co thi bo
   * qua, vi moi bo mo hinh dat ten mot kieu.
   */
  setBodyShape(name: string): void {
    this.shapeWanted = name;
    if (!this.angle) {
      return;
    }
    this.applyBodyShape(name);
    this.centerAndNormalise(this.angle);
    this.setAngle('ISO');
  }

  private applyBodyShape(name: string): void {
    const shape: BodyShape = bodyShapeOf(name);
    for (const [bone, original] of this.originalBoneScale.entries()) {
      const node = this.bonesByName.get(bone);
      if (!node) {
        continue;
      }
      const factor = shape[bone] ?? 1;
      node.scale.copy(original).multiplyScalar(factor);
    }
    this.angle?.updateMatrixWorld(true);
  }

  /** Remembers each named node and its original scale so it can be restored. */
  private collectBones(angle: THREE.Object3D): void {
    this.bonesByName = new Map();
    this.originalBoneScale = new Map();
    angle.traverse((node) => {
      if (!node.name) {
        return;
      }
      this.bonesByName.set(node.name, node);
      this.originalBoneScale.set(node.name, node.scale.clone());
    });
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
    this.bonesByName.clear();
    this.originalBoneScale.clear();
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
