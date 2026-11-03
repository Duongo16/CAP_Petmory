/**
 * Cac be xem duoc qua camera, dung chung cho trang AR, Tuy bien 3D va QR cua don.
 */
export interface PetArModel {
  id: string;
  /** Khoa dich ten mau. */
  key: string;
  kind: string;
  /** Khoa dich kieu van dong noi bat cua mau. */
  motionKey: string;
  /** Tep mo hinh (tools/build-ar-models.js): co that cua mot be, hoat anh mac dinh dat dau. */
  file: string;
  animations: {
    key: string;
    labelKey: string;
  }[];
}

/** Bo hoat anh chung cua cac mau tu goi AnimalArmature. */
const ARMATURE_ANIMATIONS = [
  { key: 'AnimalArmature|Gallop', labelKey: 'AR.ANIM.GALLOP' },
  { key: 'AnimalArmature|Walk', labelKey: 'AR.ANIM.WALK' },
  { key: 'AnimalArmature|Idle', labelKey: 'AR.ANIM.IDLE' },
  { key: 'AnimalArmature|Jump_ToIdle', labelKey: 'AR.ANIM.JUMP' },
];

export const AR_PET_MODELS: PetArModel[] = [
  {
    id: 'shiba',
    key: 'AR.MODEL.SHIBA',
    kind: 'DOG',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-ShibaInu.ar.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'husky',
    key: 'AR.MODEL.HUSKY',
    kind: 'DOG',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Husky.ar.glb',
    animations: [...ARMATURE_ANIMATIONS, { key: 'AnimalArmature|Eating', labelKey: 'AR.ANIM.EAT' }],
  },
  {
    id: 'fox',
    key: 'AR.MODEL.FOX',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.GALLOP',
    file: '/models/q-Fox.ar.glb',
    animations: ARMATURE_ANIMATIONS,
  },
  {
    id: 'bunny',
    key: 'AR.MODEL.BUNNY',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.HOP',
    file: '/models/animal-bunny.ar.glb',
    animations: [
      { key: 'run', labelKey: 'AR.ANIM.RUN' },
      { key: 'walk', labelKey: 'AR.ANIM.WALK' },
      { key: 'dance', labelKey: 'AR.ANIM.DANCE' },
      { key: 'idle', labelKey: 'AR.ANIM.IDLE' },
      { key: 'eat', labelKey: 'AR.ANIM.NIBBLE' },
    ],
  },
  {
    id: 'panda',
    key: 'AR.MODEL.PANDA',
    kind: 'OTHER',
    motionKey: 'AR.MOTION.HOP',
    file: '/models/animal-panda.ar.glb',
    animations: [
      { key: 'run', labelKey: 'AR.ANIM.RUN' },
      { key: 'walk', labelKey: 'AR.ANIM.WALK' },
      { key: 'dance', labelKey: 'AR.ANIM.DANCE' },
      { key: 'idle', labelKey: 'AR.ANIM.IDLE' },
      { key: 'eat', labelKey: 'AR.ANIM.BAMBOO' },
    ],
  },
];

/**
 * Be AR gan nhat voi mau len cua mot ban thiet ke (vd HEAD-DOG-SHIBA).
 * Chua co be meo nen meo dung tho con; giong cho chua co thi dung Shiba.
 */
export function arModelFor(modelCode: string): string {
  const code = modelCode.toLowerCase();
  if (code.includes('husky')) return 'husky';
  if (code.includes('fox')) return 'fox';
  if (code.includes('bunny') || code.includes('cat')) return 'bunny';
  return 'shiba';
}

/** Duong dan in trong QR cua don: mo trang camera cua dung be do. */
export function arLinkFor(arCode: string, origin = location.origin): string {
  return `${origin}/ar/o/${encodeURIComponent(arCode)}`;
}
