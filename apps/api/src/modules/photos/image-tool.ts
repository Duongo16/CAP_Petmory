import sharp from 'sharp';
import { QualityScore, QualityLabel } from './schemas/pet-photo.schema';
import { RestoreOperation } from './dto/photo.dto';

/** Photo scoring thresholds. The Manager can adjust them in business settings. */
export interface QualityThresholds {
  shortEdgeOk: number;
  shortEdgeWarning: number;
}

/**
 * Longest edge used when measuring sharpness. Larger images are scaled down first,
 * both for speed and so two versions of the same picture score close together.
 */
const EDGE_SHARPNESS = 1024;

/**
 * Sharpness threshold.
 *
 * This number depends on the picture: a photo full of fur texture scores very high,
 * a flat single-colour background scores low even when perfectly sharp. The threshold
 * is therefore set low, only to catch clearly blurred cases. A warning is just a
 * suggestion to restore. It never blocks an upload, and the original is always kept.
 */
const SHARPNESS_BLURRY = 15;
const SHARPNESS_OK = 60;

const BRIGHTNESS_DARK = 60;
const BRIGHTNESS_BLOWN = 200;

/**
 * Edge of the grid the two photos are reduced to before being compared. Small
 * on purpose: the question is whether the shapes still match, not whether every
 * pixel does, and a restoration is meant to change pixels.
 */
const RESEMBLANCE_GRID = 64;

/** The average brightness to aim for when fixing exposure. */
const BRIGHTNESS_TARGET = 128;

/** Maximum size when upscaling, to avoid producing an enormous file. */
const EDGE_MAX = 4096;

const WARN_RESOLUTION_TOO_LOW = 'RESOLUTION_TOO_LOW';
const WARN_RESOLUTION_LOW = 'RESOLUTION_LOW';
const WARN_TOO_BLURRY = 'TOO_BLURRY';
const WARN_SLIGHTLY_BLURRY = 'SLIGHTLY_BLURRY';
const WARN_TOO_DARK = 'UNDEREXPOSED';
const WARN_OVEREXPOSED = 'OVEREXPOSED';

export interface PhotoReadResult {
  quality: QualityScore;
  fileType: string;
}

/**
 * Measures sharpness as the variance of a Laplacian filter.
 *
 * A sharp photo has strong changes between neighbouring pixels, so the variance is
 * high. A blurred photo has near-identical neighbours, so it is low. The maths is
 * done by hand on raw pixel data because the negative half of the filter is clipped
 * away by an 8-bit image pipeline, and that negative half is exactly half of the
 * information needed to tell sharp from blurred.
 */
async function measureSharpness(buffer: Buffer): Promise<number> {
  const meta = await sharp(buffer, { failOn: 'none' }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 3 || height < 3) {
    return 0;
  }

  let pipeline = sharp(buffer, { failOn: 'none' }).greyscale();
  if (Math.max(width, height) > EDGE_SHARPNESS) {
    pipeline = pipeline.resize({
      width: width >= height ? EDGE_SHARPNESS : undefined,
      height: height > width ? EDGE_SHARPNESS : undefined,
      kernel: 'lanczos3',
    });
  }

  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  let total = 0;
  let sumOfSquares = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y += 1) {
    const row = y * w;
    for (let x = 1; x < w - 1; x += 1) {
      const i = row + x;
      const v = data[i - w] + data[i + w] + data[i - 1] + data[i + 1] - 4 * data[i];
      total += v;
      sumOfSquares += v * v;
      count += 1;
    }
  }

  if (count === 0) {
    return 0;
  }
  const mean = total / count;
  const variance = sumOfSquares / count - mean * mean;
  return Math.round(Math.max(0, variance) * 100) / 100;
}

/** Reads a photo and scores its quality. Never modifies the source file. */
export async function scorePhoto(
  data: Buffer,
  thresholds: QualityThresholds,
): Promise<PhotoReadResult> {
  const info = await sharp(data, { failOn: 'none' }).metadata();
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const shortEdge = Math.min(width, height);

  const sharpness = await measureSharpness(data);
  const stats = await sharp(data, { failOn: 'none' }).greyscale().stats();
  const brightness = Math.round(stats.channels[0]?.mean ?? 0);

  const warning = groupWarning(shortEdge, sharpness, brightness, thresholds);

  return {
    fileType: info.format ?? 'unknown',
    quality: {
      width,
      height,
      shortEdge,
      sharpness,
      brightness,
      label: assignLabel(warning, shortEdge, sharpness, thresholds),
      warning,
    },
  };
}

function groupWarning(
  shortEdge: number,
  sharpness: number,
  brightness: number,
  thresholds: QualityThresholds,
): string[] {
  const warning: string[] = [];

  if (shortEdge < thresholds.shortEdgeWarning) {
    warning.push(WARN_RESOLUTION_TOO_LOW);
  } else if (shortEdge < thresholds.shortEdgeOk) {
    warning.push(WARN_RESOLUTION_LOW);
  }

  if (sharpness < SHARPNESS_BLURRY) {
    warning.push(WARN_TOO_BLURRY);
  } else if (sharpness < SHARPNESS_OK) {
    warning.push(WARN_SLIGHTLY_BLURRY);
  }

  if (brightness < BRIGHTNESS_DARK) {
    warning.push(WARN_TOO_DARK);
  } else if (brightness > BRIGHTNESS_BLOWN) {
    warning.push(WARN_OVEREXPOSED);
  }

  return warning;
}

function assignLabel(
  warning: string[],
  shortEdge: number,
  sharpness: number,
  thresholds: QualityThresholds,
): QualityLabel {
  if (shortEdge < thresholds.shortEdgeWarning || sharpness < SHARPNESS_BLURRY) {
    return QualityLabel.UNUSABLE;
  }
  if (warning.length === 0) {
    return QualityLabel.GOOD;
  }
  if (shortEdge < thresholds.shortEdgeOk || sharpness < SHARPNESS_OK) {
    return QualityLabel.SHOULD_RESTORE;
  }
  return QualityLabel.ACCEPTABLE;
}

/**
 * Restores a photo with a fixed set of image operations.
 *
 * This is not artificial intelligence. These operations improve a moderately blurred
 * or underexposed photo, but they cannot rebuild detail that is truly gone. More
 * importantly: they never alter the pet's identifying features, because no step
 * generates new content.
 */
export async function restorePhoto(
  data: Buffer,
  operation: RestoreOperation[],
): Promise<Buffer> {
  let photo = sharp(data, { failOn: 'none' }).rotate();

  if (operation.includes('DENOISE')) {
    photo = photo.median(3);
  }

  if (operation.includes('UPSCALE')) {
    photo = await upscale(photo, data);
  }

  if (operation.includes('SHARPEN')) {
    photo = photo.sharpen({ sigma: 1.2, m1: 1, m2: 2 });
  }

  if (operation.includes('EXPOSURE')) {
    photo = await exposure(photo, data);
  }

  if (operation.includes('CONTRAST')) {
        // Stretch the tonal range by percentile so a few very bright or very dark
        // pixels cannot ruin the result.
    photo = photo.normalise({ lower: 1, upper: 99 });
  }

  return photo.png({ compressionLevel: 8 }).toBuffer();
}

/**
 * How closely the restored photo still resembles the original, from 0 to 100.
 *
 * Both photos are reduced to the same small greyscale grid and compared cell by
 * cell. Restoring only adjusts the pixels that are already there, so a healthy
 * result stays high. A low score means the shapes themselves moved, which is
 * exactly what must never happen to a pet's face, so it is worth warning about.
 * This is a plain measurement, not a judgement of how good the photo looks.
 */
export async function measureResemblance(before: Buffer, after: Buffer): Promise<number> {
  const grid = { width: RESEMBLANCE_GRID, height: RESEMBLANCE_GRID, fit: 'fill' as const };
  const [a, b] = await Promise.all([
    sharp(before, { failOn: 'none' }).greyscale().resize(grid).raw().toBuffer(),
    sharp(after, { failOn: 'none' }).greyscale().resize(grid).raw().toBuffer(),
  ]);

  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  const average = total / a.length;
  return Math.round((1 - average / 255) * 1000) / 10;
}

async function upscale(photo: sharp.Sharp, data: Buffer): Promise<sharp.Sharp> {
  const info = await sharp(data, { failOn: 'none' }).metadata();
  const width = info.width ?? 0;
  const height = info.height ?? 0;
  const factor = Math.min(2, EDGE_MAX / Math.max(width, height, 1));
  if (factor <= 1) {
    return photo;
  }
  return photo.resize({
    width: Math.round(width * factor),
    height: Math.round(height * factor),
    kernel: 'lanczos3',
  });
}

/**
 * Pulls average brightness towards the target. Unlike a contrast stretch, this
 * genuinely brightens an underexposed photo and darkens a blown-out one, as the
 * name suggests, instead of depending on the image's brightest and darkest pixels.
 */
async function exposure(photo: sharp.Sharp, data: Buffer): Promise<sharp.Sharp> {
  const stats = await sharp(data, { failOn: 'none' }).greyscale().stats();
  const current = stats.channels[0]?.mean ?? 0;
  if (current <= 1) {
    return photo;
  }
  const factor = Math.min(1.9, Math.max(0.7, BRIGHTNESS_TARGET / current));
  if (Math.abs(factor - 1) < 0.08) {
    return photo;
  }
  return photo.modulate({ brightness: factor });
}

/** Anh tra ve hay luu lai khong vuot qua muc nay, vua voi gioi han mot lan tra loi cua nen tang. */
export const PICTURE_BYTES_MAX = 4 * 1024 * 1024;

/** Anh da gon kem dang tep, de ben goi dat dung ten va dung loai noi dung. */
export interface FittedPicture {
  data: Buffer;
  fileType: 'png' | 'jpg';
  mimeType: 'image/png' | 'image/jpeg';
}

/**
 * Giu anh duoi muc dung luong cho phep.
 *
 * Anh PNG con gon thi giu nguyen. Qua nang thi doi sang JPEG voi nen trang,
 * ha dan chat luong roi thu nho canh dai neu van chua vua. Anh phuc hoi da
 * phong to len rat de vuot muc, nen moi duong tra hay luu anh phuc hoi deu
 * di qua day.
 */
export async function fitPicture(png: Buffer, limit = PICTURE_BYTES_MAX): Promise<FittedPicture> {
  if (png.length <= limit) {
    return { data: png, fileType: 'png', mimeType: 'image/png' };
  }
  const info = await sharp(png, { failOn: 'none' }).metadata();
  let edge = Math.max(info.width ?? 0, info.height ?? 0, 1);
  for (let round = 0; round < 4; round += 1) {
    for (const quality of [90, 84, 76]) {
      const jpeg = await sharp(png, { failOn: 'none' })
        .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (jpeg.length <= limit) {
        return { data: jpeg, fileType: 'jpg', mimeType: 'image/jpeg' };
      }
    }
    edge = Math.round(edge * 0.75);
  }
  throw new Error('Khong thu nho duoc anh xuong duoi gioi han');
}
