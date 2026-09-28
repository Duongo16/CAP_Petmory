/**
 * Reads a model file directly to count material zones, meshes and animations.
 * No modelling software needed: the file is a binary container holding one block
 * of structured text describing the scene.
 * Run: node tools/inspect-glb.js <folder-path>
 */
const fs = require('fs');
const nodePath = require('path');

const MAGIC = 0x46546c67; // glTF magic number
const JSON_CHUNK = 0x4e4f534a;

function readJsonFromGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== MAGIC) {
    throw new Error('Not a valid GLB file');
  }
  let offset = 12;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const kind = buf.readUInt32LE(offset + 4);
    const content = buf.subarray(offset + 8, offset + 8 + length);
    if (kind === JSON_CHUNK) {
      return JSON.parse(content.toString('utf8'));
    }
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  throw new Error('No JSON chunk found in the file');
}

function countVertices(gltf) {
  return (gltf.meshes ?? []).reduce((total, mesh) => {
    const perMesh = (mesh.primitives ?? []).reduce((t, p) => {
      const index = p.attributes?.POSITION;
      const accessor = gltf.accessors?.[index];
      return t + (accessor?.count ?? 0);
    }, 0);
    return total + perMesh;
  }, 0);
}

function analyse(file) {
  const gltf = readJsonFromGlb(file);
  const material = (gltf.materials ?? []).map((m, i) => m.name || `material-${i}`);
  const mesh = (gltf.meshes ?? []).map((m, i) => m.name || `mesh-${i}`);
  const groupCount = (gltf.meshes ?? []).reduce((t, m) => t + (m.primitives ?? []).length, 0);
  const animations = (gltf.animations ?? []).map((a, i) => a.name || `animation-${i}`);
  const boneCount = (gltf.skins ?? []).reduce((t, s) => t + (s.joints ?? []).length, 0);

  return {
    name: nodePath.basename(file),
    sizeKb: Math.round(fs.statSync(file).size / 1024),
    countMaterial: material.length,
    nameMaterial: material,
    countMesh: mesh.length,
    groupCount,
    countVertex: countVertices(gltf),
    animationCount: animations.length,
    animationNames: animations,
    boneCount,
    hasTexture: (gltf.textures ?? []).length > 0,
  };
}

const dir = process.argv[2] ?? 'apps/web/public/models';
const file = fs
  .readdirSync(dir)
  .filter((f) => f.toLowerCase().endsWith('.glb'))
  .sort();

if (file.length === 0) {
  console.log('No GLB file found in', dir);
  process.exit(0);
}

console.log('3D MODEL ANALYSIS');
console.log('='.repeat(72));

for (const f of file) {
  const result = analyse(nodePath.join(dir, f));
  console.log('');
  console.log(`${result.name}  (${result.sizeKb} KB)`);
  console.log(`  Material zones   : ${result.countMaterial}   <-- the number that matters`);
  console.log(`  Zone names       : ${result.nameMaterial.join(', ') || 'none'}`);
  console.log(`  Meshes / groups  : ${result.countMesh} / ${result.groupCount}`);
  console.log(`  Vertices         : ${result.countVertex.toLocaleString('en-US')}`);
  console.log(`  Bones            : ${result.boneCount}`);
  console.log(`  Animations       : ${result.animationCount}`);
  if (result.animationCount > 0) {
    console.log(`  Animation names  : ${result.animationNames.join(', ')}`);
  }
  console.log(`  Uses a texture   : ${result.hasTexture ? 'yes' : 'no, colour sits in the material'}`);
}

console.log('');
console.log('='.repeat(72));
console.log('One material zone means the whole animal can only take a single colour.');
console.log('To colour ears, belly and tail separately, split the zones again in Blender.');
