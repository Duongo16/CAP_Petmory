/** Run after `npm run build --workspace apps/api`: node --test tools/test-diary-music-unit.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DiaryService } = require('../apps/api/dist/modules/memories/diary.service.js');
const { model, Types } = require('mongoose');
const { PetSchema } = require('../apps/api/dist/modules/pets/schemas/pet.schema.js');

function fixture() {
  const pet = {
    diaryMusic: { source: 'NONE', title: '', youtubeId: '', sampleCode: '', fileName: '', mimeType: '' },
    async save() { return this; },
  };
  const calls = [];
  const store = {
    async save(...args) { calls.push(['save', ...args]); },
    async remove(...args) { calls.push(['remove', ...args]); },
    async read() { return Buffer.from('audio'); },
  };
  const petModel = { findOne: () => ({ exec: async () => null }) };
  const shareModel = { findOne: () => ({ exec: async () => null }) };
  const service = new DiaryService({}, petModel, {}, shareModel, { findOwned: async () => pet }, store);
  return { service, pet, calls };
}

test('new diaries start with a sample track', () => {
  const PetModel = model('PetMusicUnit', PetSchema);
  const pet = new PetModel({ owner: new Types.ObjectId(), name: 'Milo' });
  assert.equal(pet.diaryMusic.source, 'SAMPLE');
  assert.equal(pet.diaryMusic.sampleCode, 'HOP_NHAC_DIU_DANG');
  const oldPet = PetModel.hydrate({ _id: new Types.ObjectId(), owner: new Types.ObjectId(), name: 'Old' });
  assert.equal(oldPet.diaryMusic.source, 'SAMPLE');
});

test('sample choice is restricted to bundled tracks and replaces an upload', async () => {
  const { service, pet, calls } = fixture();
  pet.diaryMusic.fileName = 'old.mp3';
  await service.setSampleMusic('pet', 'owner', 'HOP_NHAC_DIU_DANG');
  assert.equal(pet.diaryMusic.source, 'SAMPLE');
  assert.equal(pet.diaryMusic.sampleCode, 'HOP_NHAC_DIU_DANG');
  assert.deepEqual(calls.at(-1), ['remove', 'diary-music', 'old.mp3']);
  await assert.rejects(service.setSampleMusic('pet', 'owner', 'UNKNOWN'));
});

test('YouTube links use a video id and reject a lookalike host', async () => {
  const { service, pet } = fixture();
  await service.setYoutubeMusic('pet', 'owner', 'https://youtu.be/M7lc1UVf-VE');
  assert.equal(pet.diaryMusic.youtubeId, 'M7lc1UVf-VE');
  await assert.rejects(service.setYoutubeMusic('pet', 'owner', 'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE'));
});

test('upload checks file bytes before saving', async () => {
  const { service, pet, calls } = fixture();
  const wav = Buffer.alloc(44);
  wav.write('RIFF', 0);
  wav.write('WAVE', 8);
  await service.uploadMusic('pet', 'owner', { buffer: wav, size: wav.length, mimetype: '', originalname: 'memory.wav' });
  assert.equal(pet.diaryMusic.source, 'UPLOAD');
  assert.equal(calls[0][0], 'save');
  assert.equal(calls[0][1], 'diary-music');
  await assert.rejects(service.uploadMusic('pet', 'owner', { buffer: Buffer.from('not audio'), size: 9, mimetype: 'audio/wav' }));
});

test('private diary audio is not served publicly', async () => {
  const { service } = fixture();
  await assert.rejects(service.publicMusic('507f1f77bcf86cd799439011'));
});
