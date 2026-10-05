import * as THREE from 'three';

/** Two paint modes: brush over small patches, or flood one patch of a single colour. */
export type PaintMode = 'BRUSH' | 'FILL';

/**
 * The painted colours of one mesh, in a form that can be saved.
 *
 * The colour string is groups of six hexadecimal characters run together, each
 * group one face in mesh face order. It is compact and reads back exactly.
 */
export interface PaintState {
  mesh: string;
  color: string;
}

/**
 * Converts a colour from the working colour space into a six-character hexadecimal string.
 *
 * It has to go through the library's colour class rather than multiplying three numbers
 * by 255, because the values in the buffer are in linear space while the hexadecimal
 * string is in display space. Multiplying by hand yields the wrong colour on reload.
 */
const TEMP_COLOR = new THREE.Color();

function toColorString(r: number, g: number, b: number): string {
  TEMP_COLOR.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
  return TEMP_COLOR.getHexString(THREE.SRGBColorSpace);
}

interface MeshPaint {
  mesh: THREE.Mesh;
  /** Per-vertex colour. Each face has its own three vertices, so faces can be painted one by one. */
  colorAttribute: THREE.BufferAttribute;
  /** For each face, the faces next to it. Used by flood fill. */
  adjacentFaces: number[][];
  /** The centre of each face in local coordinates, used by the brush. */
  faceCenters: THREE.Vector3[];
  /**
   * Ten mang vat lieu goc cua tung mat.
   *
   * Sau khi mau chuyen vao tung dinh, ten mang vat lieu khong con dieu khien
   * mau nua. Giu lai o day de van to duoc ca mot vung mot luc, vi dong nay la
   * thu noi mot phuong an goi y voi hinh nguoi dung nhin thay.
   */
  faceMaterial: string[];
}

const UNDO_LIMIT = 30;

/**
 * Allows colour to be painted straight onto the model.
 *
 * How it works: the mesh is converted so each face owns its own vertices, the original
 * colour is read out of the texture and written into the vertex colours, and then the
 * texture is dropped. From that point the visible colour lives in the vertex colours,
 * so one face can be painted without affecting any other.
 */
export class Painter {
  private readonly meshes: MeshPaint[] = [];
  private readonly undoStack: Map<THREE.Mesh, Float32Array>[] = [];

  constructor(angle: THREE.Object3D) {
    const photo = this.getTexture(angle);
    angle.traverse((node) => {
            // Accepts both plain meshes and skinned ones. Converting to one set of vertices
            // per face keeps the skinning attributes, so the model does not fall apart.
      if (node instanceof THREE.Mesh) {
        this.prepareMesh(node, photo);
      }
    });
  }

  get ready(): boolean {
    return this.meshes.length > 0;
  }

  /**
   * Paints at the point the ray hits. Returns true if anything changed.
   * The radius is in the model's local units.
   */
  paint(ray: THREE.Raycaster, hexColor: string, mode: PaintMode, radius: number): boolean {
    const score = ray.intersectObjects(
      this.meshes.map((x) => x.mesh),
      false,
    )[0];
    const faceScore = score?.faceIndex;
    if (!score || faceScore === undefined || faceScore === null) {
      return false;
    }
    const item = this.meshes.find((x) => x.mesh === score.object);
    if (!item) {
      return false;
    }

    this.pushUndo();
    const color = new THREE.Color(hexColor);
    const countFace = item.faceCenters.length;

    if (mode === 'FILL') {
      const sourceColor = this.readColorFace(item, faceScore);
      const visited = new Set<number>([faceScore]);
      const queue: number[] = [faceScore];
      while (queue.length > 0) {
        const face = queue.pop() as number;
        this.writeColorFace(item, face, color);
        for (const neighbour of item.adjacentFaces[face] ?? []) {
          if (!visited.has(neighbour) && this.readColorFace(item, neighbour).equals(sourceColor)) {
            visited.add(neighbour);
            queue.push(neighbour);
          }
        }
      }
    } else {
      const localPoint = item.mesh.worldToLocal(score.point.clone());
      for (let face = 0; face < countFace; face += 1) {
        if (item.faceCenters[face].distanceTo(localPoint) <= radius) {
          this.writeColorFace(item, face, color);
        }
      }
    }

    item.colorAttribute.needsUpdate = true;
    return true;
  }

  /**
   * Exports the current colour of every face. Only named meshes are exported, because
   * without a name there is no way to match colours back to the right mesh later.
   */
  exportStatus(): PaintState[] {
    const result: PaintState[] = [];
    for (const item of this.meshes) {
      if (!item.mesh.name) {
        continue;
      }
      const part: string[] = [];
      for (let face = 0; face < item.faceCenters.length; face += 1) {
        const i = face * 3;
        part.push(
          toColorString(
            item.colorAttribute.getX(i),
            item.colorAttribute.getY(i),
            item.colorAttribute.getZ(i),
          ),
        );
      }
      result.push({ mesh: item.mesh.name, color: part.join('') });
    }
    return result;
  }

  /**
   * Dem mau cua cac mat theo tung mang vat lieu goc.
   *
   * Mau da to nam o tung dinh, khong o vat lieu, nen muon biet mot vung dang
   * mang mau gi thi phai dem mat. Tra ve so mat cua tung mau, theo ten vat lieu.
   */
  colorCountByMaterial(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const item of this.meshes) {
      for (let face = 0; face < item.faceCenters.length; face += 1) {
        const i = face * 3;
        const hex = toColorString(item.colorAttribute.getX(i), item.colorAttribute.getY(i), item.colorAttribute.getZ(i));
        const material = item.faceMaterial[face] || 'unnamed';
        const counts = (out[material] ??= {});
        counts[hex] = (counts[hex] ?? 0) + 1;
      }
    }
    return out;
  }

  /**
   * Reloads saved colours. A mesh whose name or face count does not match is skipped,
   * so an old draft cannot break the model if the model library changes later.
   * Returns how many meshes were loaded.
   */
  loadStatus(status: PaintState[]): number {
    let loaded = 0;
    for (const part of status) {
      const item = this.meshes.find((x) => x.mesh.name === part.mesh);
      if (!item || part.color.length !== item.faceCenters.length * 6) {
        continue;
      }
      for (let face = 0; face < item.faceCenters.length; face += 1) {
        const color = new THREE.Color(`#${part.color.slice(face * 6, face * 6 + 6)}`);
        this.writeColorFace(item, face, color);
      }
      item.colorAttribute.needsUpdate = true;
      loaded += 1;
    }
    return loaded;
  }

  undo(): boolean {
    const step = this.undoStack.pop();
    if (!step) {
      return false;
    }
    for (const item of this.meshes) {
      const before = step.get(item.mesh);
      if (before) {
        (item.colorAttribute.array as Float32Array).set(before);
        item.colorAttribute.needsUpdate = true;
      }
    }
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Paints the whole model a single colour. */
  paintAll(hexColor: string): void {
    this.pushUndo();
    const color = new THREE.Color(hexColor);
    for (const item of this.meshes) {
      for (let face = 0; face < item.faceCenters.length; face += 1) {
        this.writeColorFace(item, face, color);
      }
      item.colorAttribute.needsUpdate = true;
    }
  }

  /**
   * To mau ca mot hoac nhieu vung cung luc.
   *
   * Nhan ban do tu ten mang vat lieu sang mau. Tra ve so mat da to, de ben goi
   * biet ban do co khop voi tep mo hinh dang mo hay khong thay vi doan.
   *
   * To ca cum trong mot buoc, nen bam hoan tac mot lan la ve nguyen trang thai
   * truoc do chu khong phai bam sau lan cho sau vung.
   */
  paintZones(colorByZone: Record<string, string>): number {
    const colorOf = new Map<string, THREE.Color>();
    for (const [zone, hex] of Object.entries(colorByZone)) {
      colorOf.set(zone, new THREE.Color(hex));
    }
    if (colorOf.size === 0) {
      return 0;
    }

    this.pushUndo();
    let painted = 0;
    for (const item of this.meshes) {
      let touched = false;
      for (let face = 0; face < item.faceCenters.length; face += 1) {
        const color = colorOf.get(item.faceMaterial[face]);
        if (!color) {
          continue;
        }
        this.writeColorFace(item, face, color);
        painted += 1;
        touched = true;
      }
      if (touched) {
        item.colorAttribute.needsUpdate = true;
      }
    }
    return painted;
  }

  private pushUndo(): void {
    const step = new Map<THREE.Mesh, Float32Array>();
    for (const item of this.meshes) {
      step.set(item.mesh, Float32Array.from(item.colorAttribute.array as Float32Array));
    }
    this.undoStack.push(step);
    if (this.undoStack.length > UNDO_LIMIT) {
      this.undoStack.shift();
    }
  }

  private readColorFace(item: MeshPaint, face: number): THREE.Color {
    const i = face * 3;
    return new THREE.Color(
      item.colorAttribute.getX(i),
      item.colorAttribute.getY(i),
      item.colorAttribute.getZ(i),
    );
  }

  private writeColorFace(item: MeshPaint, face: number, color: THREE.Color): void {
    for (let k = 0; k < 3; k += 1) {
      item.colorAttribute.setXYZ(face * 3 + k, color.r, color.g, color.b);
    }
  }

  /** Returns the first texture found, used to read the model's original colours. */
  private getTexture(angle: THREE.Object3D): ImageData | null {
    let source: THREE.Texture | null = null;
    angle.traverse((node) => {
      if (source || !(node instanceof THREE.Mesh)) {
        return;
      }
      const list = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of list) {
        const map = (material as THREE.MeshStandardMaterial).map;
        if (map?.image) {
          source = map;
          return;
        }
      }
    });
    if (!source) {
      return null;
    }
    const photo = (source as THREE.Texture).image as CanvasImageSource & {
      width: number;
      height: number;
    };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = photo.width;
      canvas.height = photo.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return null;
      }
      ctx.drawImage(photo, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch {
      return null;
    }
  }

  private prepareMesh(mesh: THREE.Mesh, photo: ImageData | null): void {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    mesh.geometry = geometry;

    const position = geometry.getAttribute('position');
    const countVertex = position.count;
    const color = new Float32Array(countVertex * 3);
    const uv = geometry.getAttribute('uv');
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    /**
     * If the model has a texture, colours are read from it. If the model carries its
     * colours in the material instead, the material colour for each group of faces is
     * used. That way the painting layer works with both kinds of model.
     */
    const group =
      geometry.groups.length > 0
        ? geometry.groups
        : [{ start: 0, count: countVertex, materialIndex: 0 }];

    const faceMaterial: string[] = new Array(Math.floor(countVertex / 3)).fill('');

    for (const g of group) {
      const material = materials[g.materialIndex ?? 0] as THREE.MeshStandardMaterial | undefined;
      const faceFirst = Math.floor(g.start / 3);
      const faceLast = Math.floor((g.start + g.count) / 3);
      for (let face = faceFirst; face < faceLast; face += 1) {
        faceMaterial[face] = material?.name || 'unnamed';
        const c = photo
          ? this.readSourceColor(photo, uv, face)
          : (material?.color.clone() ?? new THREE.Color('#dddddd'));
        for (let k = 0; k < 3; k += 1) {
          const i = (face * 3 + k) * 3;
          color[i] = c.r;
          color[i + 1] = c.g;
          color[i + 2] = c.b;
        }
      }
    }

    const colorAttribute = new THREE.BufferAttribute(color, 3);
    geometry.setAttribute('color', colorAttribute);

    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      const prepare = material as THREE.MeshStandardMaterial;
      prepare.map = null;
      prepare.vertexColors = true;
      prepare.color.set('#ffffff');
      prepare.needsUpdate = true;
    }

    this.meshes.push({
      mesh,
      colorAttribute,
      adjacentFaces: this.buildAdjacentFaces(position),
      faceCenters: this.computeFaceCenters(position),
      faceMaterial,
    });
  }

  /** Reads the original colour at the centre of a face from the texture. With no texture, white is used. */
  private readSourceColor(
    photo: ImageData | null,
    uv: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined,
    face: number,
  ): THREE.Color {
    if (!photo || !uv) {
      return new THREE.Color('#dddddd');
    }
    let u = 0;
    let v = 0;
    for (let k = 0; k < 3; k += 1) {
      u += uv.getX(face * 3 + k);
      v += uv.getY(face * 3 + k);
    }
    u /= 3;
    v /= 3;
    const x = Math.min(photo.width - 1, Math.max(0, Math.round(u * (photo.width - 1))));
        // The model format puts the image origin at the top left, so the vertical axis is not flipped.
    const y = Math.min(photo.height - 1, Math.max(0, Math.round(v * (photo.height - 1))));
    const i = (y * photo.width + x) * 4;
        // Colours read from an image are in display space. They are handed to the colour
        // class together with the space they are in, so the library converts them correctly.
    return new THREE.Color().setRGB(
      photo.data[i] / 255,
      photo.data[i + 1] / 255,
      photo.data[i + 2] / 255,
      THREE.SRGBColorSpace,
    );
  }

  private computeFaceCenters(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.Vector3[] {
    const list: THREE.Vector3[] = [];
    for (let face = 0; face < position.count / 3; face += 1) {
      const t = new THREE.Vector3();
      for (let k = 0; k < 3; k += 1) {
        const i = face * 3 + k;
        t.x += position.getX(i);
        t.y += position.getY(i);
        t.z += position.getZ(i);
      }
      list.push(t.divideScalar(3));
    }
    return list;
  }

  /**
   * Two faces count as neighbours when they share at least two vertices at the same
   * position. Vertices are grouped by rounded position so tiny differences are ignored.
   */
  private buildAdjacentFaces(
    position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  ): number[][] {
    const countFace = position.count / 3;
    const faceByVertex = new Map<string, number[]>();

    for (let face = 0; face < countFace; face += 1) {
      for (let k = 0; k < 3; k += 1) {
        const i = face * 3 + k;
        const key = `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
        const list = faceByVertex.get(key) ?? [];
        list.push(face);
        faceByVertex.set(key, list);
      }
    }

    const sharedCount: Map<number, number>[] = Array.from({ length: countFace }, () => new Map());
    for (const list of faceByVertex.values()) {
      for (const a of list) {
        for (const b of list) {
          if (a !== b) {
            sharedCount[a].set(b, (sharedCount[a].get(b) ?? 0) + 1);
          }
        }
      }
    }

    return sharedCount.map((m) => [...m.entries()].filter(([, count]) => count >= 2).map(([b]) => b));
  }
}
