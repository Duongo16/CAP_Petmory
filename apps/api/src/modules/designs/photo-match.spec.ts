import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { cleanReading, nearestCode, pickModel, readColoursLocally, zonePaintOf } from './photo-match';
import { BaseModel } from './model-library.service';

const ZONES = ['MAIN_FUR', 'BELLY_FUR', 'EAR', 'TAIL', 'EYE', 'NOSE'];

const model = (code: string, kind: string, pose: string, core = true): BaseModel =>
  ({ code, name: code, kind, pose, file: `${code}.glb`, ready: true, core }) as BaseModel;

const LIBRARY = [
  model('BASE-DOG-STAND', 'DOG', 'STANDING'),
  model('BASE-DOG-SIT', 'DOG', 'SITTING'),
  model('BASE-CAT-SIT', 'CAT', 'SITTING'),
  model('BASE-CAT-LIE', 'CAT', 'LYING'),
  model('Q-FOX', 'OTHER', 'STANDING', false),
];

const FUR = [
  { code: 'W-ORANGE', swatch: '#c8742f' },
  { code: 'W-CREAM', swatch: '#f4ead8' },
  { code: 'W-BLACK', swatch: '#222222' },
  { code: 'W-GREY', swatch: '#8a8987' },
];
const FACE = [
  { code: 'E-BROWN', swatch: '#4a2c17' },
  { code: 'E-BLACK', swatch: '#141414' },
];

describe('nearestCode', () => {
  it('picks the closest wool colour', () => {
    expect(nearestCode('#d07a33', FUR)).toBe('W-ORANGE');
    expect(nearestCode('#fffaf0', FUR)).toBe('W-CREAM');
  });

  it('refuses a colour that is not six hex digits', () => {
    expect(nearestCode('orange', FUR)).toBeNull();
  });
});

describe('pickModel', () => {
  it('matches kind and pose when both exist', () => {
    expect(pickModel(LIBRARY, 'CAT', 'LYING')).toEqual({ model: LIBRARY[3], fallback: false });
  });

  it('keeps the kind when the pose is missing', () => {
    expect(pickModel(LIBRARY, 'DOG', 'LYING')?.model.kind).toBe('DOG');
  });

  it('falls back to the default model for a kind without a model, never to a legacy one', () => {
    expect(pickModel(LIBRARY, 'OTHER', 'STANDING')).toEqual({ model: LIBRARY[1], fallback: true });
  });
});

describe('zonePaintOf', () => {
  it('fills every zone, borrowing the body colour and using dark eyes by default', () => {
    const paint = zonePaintOf(ZONES, { MAIN_FUR: '#c8742f', BELLY_FUR: '#f5ecda' }, FUR, FACE);
    expect(paint).toEqual([
      { zone: 'MAIN_FUR', colorCode: 'W-ORANGE' },
      { zone: 'BELLY_FUR', colorCode: 'W-CREAM' },
      { zone: 'EAR', colorCode: 'W-ORANGE' },
      { zone: 'TAIL', colorCode: 'W-ORANGE' },
      { zone: 'EYE', colorCode: 'E-BROWN' },
      { zone: 'NOSE', colorCode: 'E-BLACK' },
    ]);
  });
});

describe('cleanReading', () => {
  it('keeps only known kinds, poses and well formed colours', () => {
    const read = cleanReading({ kind: 'cat', pose: 'flying', colors: { MAIN_FUR: '#8a8987', TAIL: '', EYE: 'green' } }, ZONES);
    expect(read).toEqual({ kind: 'CAT', pose: '', breed: '', colours: { MAIN_FUR: '#8a8987' } });
  });

  it('gives up on an answer with nothing usable', () => {
    expect(cleanReading({ kind: 'dragon' }, ZONES)).toBeNull();
    expect(cleanReading('not json', ZONES)).toBeNull();
  });
});

describe('readColoursLocally', () => {
  it('finds the body colour of an orange pet on a pale background', async () => {
    const photo = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#f2f2f2' } })
      .composite([{ input: await sharp({ create: { width: 110, height: 110, channels: 3, background: '#c8742f' } }).png().toBuffer(), left: 45, top: 45 }])
      .png()
      .toBuffer();
    const colours = await readColoursLocally(photo);
    expect(nearestCode(colours.MAIN_FUR ?? '', FUR)).toBe('W-ORANGE');
  });
});
