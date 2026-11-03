/**
 * Builds the copies of the animal models that the WebAR page opens.
 *
 * The source models were made at whatever size the artist liked: the dogs are
 * three metres tall and the bunny is two. AR shows a model at its true size,
 * so in the room they came out as big as a car and had to be pinched down to
 * about a tenth. Google's Scene Viewer reads the file itself and ignores any
 * scale set on the page, so the size has to live inside the file.
 *
 * Each copy wraps the scene in one new root node scaled to a real pet height,
 * and moves the default motion to the front of the animation list, because
 * Scene Viewer starts on the first one and cannot be told to switch.
 *
 * Nothing else changes: the binary chunk is copied byte for byte, so meshes,
 * skins and textures stay exactly as in the source.
 *
 * Run: node tools/build-ar-models.js
 */
const fs = require('fs');
const nodePath = require('path');

const MODEL_DIR = nodePath.join(__dirname, '..', 'apps', 'web', 'public', 'models');

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

/** Source file, target height in metres, and the motion that plays first. */
const MODELS = [
  { file: 'q-ShibaInu', height: 0.4, first: 'AnimalArmature|Gallop' },
  { file: 'q-Husky', height: 0.5, first: 'AnimalArmature|Gallop' },
  { file: 'q-Fox', height: 0.35, first: 'AnimalArmature|Gallop' },
  { file: 'animal-bunny', height: 0.25, first: 'run' },
  { file: 'animal-panda', height: 0.5, first: 'run' },
];

/**
 * Height of each source model as model-viewer measures it once loaded
 * (getDimensions().y). Measured in a browser because the dogs are skinned and
 * their bounds only make sense after the bones are applied.
 */
const SOURCE_HEIGHT = {
  'q-ShibaInu': 3.089,
  'q-Husky': 3.187,
  'q-Fox': 2.692,
  'animal-bunny': 2.01,
  'animal-panda': 1.501,
};

function readGlb(path) {
  const data = fs.readFileSync(path);
  if (data.readUInt32LE(0) !== MAGIC) {
    throw new Error(`${path} is not a GLB file`);
  }
  const jsonLength = data.readUInt32LE(12);
  if (data.readUInt32LE(16) !== JSON_CHUNK) {
    throw new Error(`${path} does not start with a JSON chunk`);
  }
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString('utf8'));
  return { json, rest: data.subarray(20 + jsonLength) };
}

function writeGlb(path, json, rest) {
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(MAGIC, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + text.length + rest.length, 8);
  head.writeUInt32LE(text.length, 12);
  head.writeUInt32LE(JSON_CHUNK, 16);
  fs.writeFileSync(path, Buffer.concat([head, text, rest]));
}

for (const one of MODELS) {
  const source = nodePath.join(MODEL_DIR, `${one.file}.glb`);
  const target = nodePath.join(MODEL_DIR, `${one.file}.ar.glb`);
  const { json, rest } = readGlb(source);

  const factor = one.height / SOURCE_HEIGHT[one.file];
  const sceneIndex = json.scene ?? 0;
  const scene = json.scenes[sceneIndex];
  // A new node at the end of the list keeps every existing index (skins,
  // animation targets) pointing at the same node as before.
  json.nodes.push({ name: 'AR_SCALE', scale: [factor, factor, factor], children: scene.nodes });
  scene.nodes = [json.nodes.length - 1];

  const at = (json.animations ?? []).findIndex((clip) => clip.name === one.first);
  if (at < 0) {
    throw new Error(`${one.file} has no animation named ${one.first}`);
  }
  json.animations.unshift(...json.animations.splice(at, 1));

  writeGlb(target, json, rest);
  console.log(
    `${one.file}.ar.glb  height ${one.height} m (x${factor.toFixed(4)}), first motion ${one.first}`,
  );
}
