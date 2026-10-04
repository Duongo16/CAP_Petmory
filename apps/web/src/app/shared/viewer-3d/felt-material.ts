import * as THREE from 'three';

/**
 * Chat len choc cho mau ba chieu.
 *
 * Khong dung anh van be mat, vi nhieu tep mo hinh khong co toa do anh. Thay
 * vao do doan ma to bong tu sinh nhieu theo vi tri trong khong gian: lam be
 * mat gon nhe nhu soi len, lam mau loang lo rat nhe, va them mot vien sang mo
 * o mep giong lop long to boc ngoai tuong len. Mau van nam o tung dinh nhu cu,
 * nen lop to mau khong can biet gi ve chat len.
 */

/** Do manh cua tung hieu ung, chinh mot cho cho ca ung dung. */
const FELT = {
  /** Mat do soi, tinh tren mo hinh da chuan hoa ve kich thuoc mot don vi. */
  fibreScale: 140,
  /** Mat do cum len lon hon, cho be mat gon song nhe. */
  clumpScale: 18,
  bump: 0.12,
  speckle: 0.035,
  fuzz: 0.45,
};

const NOISE_GLSL = /* glsl */ `
varying vec3 vFeltPos;
uniform float uFeltFibre;
uniform float uFeltClump;
uniform float uFeltBump;
uniform float uFeltSpeckle;
uniform float uFeltFuzz;

float feltHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float feltNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(feltHash(i), feltHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(feltHash(i + vec3(0.0, 1.0, 0.0)), feltHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(feltHash(i + vec3(0.0, 0.0, 1.0)), feltHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(feltHash(i + vec3(0.0, 1.0, 1.0)), feltHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float feltHeight(vec3 p) {
  // Soi keo dai theo mot huong cho giong len choc, khong lam tron deu nhu cat.
  vec3 q = vec3(p.x, p.y * 0.25, p.z);
  float fibre = feltNoise(q * uFeltFibre) * 0.6 + feltNoise(q.zxy * uFeltFibre * 0.7 + 7.1) * 0.4;
  float clump = feltNoise(p * uFeltClump) * 0.7 + feltNoise(p * uFeltClump * 2.1 + 3.3) * 0.3;
  return fibre * 0.45 + clump * 0.55;
}
`;

/** Nhung vat lieu da khoac chat len, de khong gan hai lan. */
const FELTED = new WeakSet<THREE.Material>();

/** Gan chat len vao mot vat lieu dang co, giu nguyen moi thu khac cua no. */
export function applyFelt(material: THREE.MeshStandardMaterial): void {
  if (FELTED.has(material)) {
    return;
  }
  FELTED.add(material);
  material.roughness = 1;
  material.metalness = 0;
  // Bong phang theo tung mat se bo qua phap tuyen da lam mem.
  material.flatShading = false;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uFeltFibre'] = { value: FELT.fibreScale };
    shader.uniforms['uFeltClump'] = { value: FELT.clumpScale };
    shader.uniforms['uFeltBump'] = { value: FELT.bump };
    shader.uniforms['uFeltSpeckle'] = { value: FELT.speckle };
    shader.uniforms['uFeltFuzz'] = { value: FELT.fuzz };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFeltPos;')
      .replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\nvFeltPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float feltH = feltHeight(vFeltPos);
        diffuseColor.rgb *= 1.0 - uFeltSpeckle + uFeltSpeckle * 2.0 * feltH;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          vec2 dHdxy = vec2(dFdx(feltH), dFdy(feltH)) * uFeltBump;
          vec3 sigmaX = dFdx(-vViewPosition);
          vec3 sigmaY = dFdy(-vViewPosition);
          vec3 r1 = cross(sigmaY, normal);
          vec3 r2 = cross(normal, sigmaX);
          float det = dot(sigmaX, r1) * faceDirection;
          vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `{
          float rim = 1.0 - saturate(dot(normal, normalize(vViewPosition)));
          outgoingLight += diffuseColor.rgb * uFeltFuzz * pow(rim, 2.2) * (0.6 + 0.8 * feltH);
        }
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'pm-felt';
  material.needsUpdate = true;
}

/**
 * Lam mem cac canh gay cua mo hinh it mat, giu lai canh that sac.
 *
 * Moi mat co dinh rieng sau khi lop to mau chuan bi, nen phap tuyen dang
 * phang tung mat. O day cong phap tuyen cua cac mat chung mot dinh, nhung chi
 * voi mat lech nhau duoi goc gioi han, de mo hinh khoi vuong van con canh.
 */
export function softenNormals(geometry: THREE.BufferGeometry, creaseDegrees = 50): void {
  const position = geometry.getAttribute('position');
  if (!position || geometry.index) {
    return;
  }
  const countFace = Math.floor(position.count / 3);
  const faceNormal: THREE.Vector3[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let face = 0; face < countFace; face += 1) {
    a.fromBufferAttribute(position, face * 3);
    b.fromBufferAttribute(position, face * 3 + 1);
    c.fromBufferAttribute(position, face * 3 + 2);
    faceNormal.push(new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize());
  }

  // Gom cac dinh trung vi tri, lam tron de sai so nho van nhan ra la mot.
  const facesAt = new Map<string, number[]>();
  const keyOf = (i: number): string =>
    `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
  for (let i = 0; i < position.count; i += 1) {
    const key = keyOf(i);
    const list = facesAt.get(key);
    if (list) {
      list.push(Math.floor(i / 3));
    } else {
      facesAt.set(key, [Math.floor(i / 3)]);
    }
  }

  const limit = Math.cos(THREE.MathUtils.degToRad(creaseDegrees));
  const normals = new Float32Array(position.count * 3);
  const sum = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    const own = faceNormal[Math.floor(i / 3)];
    sum.set(0, 0, 0);
    for (const face of facesAt.get(keyOf(i)) ?? []) {
      if (faceNormal[face].dot(own) >= limit) {
        sum.add(faceNormal[face]);
      }
    }
    if (sum.lengthSq() === 0) {
      sum.copy(own);
    }
    sum.normalize();
    normals[i * 3] = sum.x;
    normals[i * 3 + 1] = sum.y;
    normals[i * 3 + 2] = sum.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}
