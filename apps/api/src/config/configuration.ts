/**
 * Reads configuration from environment variables. Secrets are never hard coded.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  webOrigin: string;
  mail: {
    /** May chu SMTP. Rong thi khong gui thu; o moi truong phat trien noi dung thu duoc ghi ra nhat ky. */
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    timeoutMs: number;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  upload: {
    dir: string;
    maxSizeMb: number;
  };
  ai: {
    /** Nha cung cap: gemini hoac anthropic. Rong thi chon theo khoa dang co. */
    provider: string;
    apiKey: string;
    geminiKey: string;
    /** Rong thi dung mo hinh mac dinh cua nha cung cap. */
    model: string;
    /** Mo hinh sua anh cua Gemini, dung cho phuc hoi anh. Rong thi dung mac dinh. */
    imageModel: string;
    /** Noi sua anh khi phuc hoi: cloudinary, huggingface hoac gemini. */
    imageProvider: string;
    /** Cau hinh Hugging Face Inference Providers cho phuc hoi anh. */
    huggingface: {
      token: string;
      imageModel: string;
      provider: string;
      endpointUrl: string;
      /** URL Space Gradio công khai dùng để upscale/khôi phục ảnh thú cưng. */
      spaceUrl: string;
      spaceApiName: string;
      spaceScale: number;
    };
    timeoutMs: number;
  };
  storage: {
    driver: string;
    cloudinary: {
      cloudName: string;
      apiKey: string;
      apiSecret: string;
      signedSeconds: number;
    };
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3000),
  mongodbUri: required('MONGODB_URI'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:4200',
  mail: {
    host: (process.env.SMTP_HOST ?? '').trim(),
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: (process.env.SMTP_SECURE ?? '').trim().toLowerCase() === 'true',
    user: (process.env.SMTP_USER ?? '').trim(),
    pass: process.env.SMTP_PASS ?? '',
    from: (process.env.SMTP_FROM ?? 'Petmory <no-reply@petmory.local>').trim(),
    timeoutMs: Number(process.env.SMTP_TIMEOUT_MS ?? 10000),
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR ?? './uploads',
    maxSizeMb: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10),
  },
  ai: {
    provider: (process.env.AI_PROVIDER ?? '').trim().toLowerCase(),
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    geminiKey: process.env.GEMINI_API_KEY ?? '',
    model: (process.env.AI_MODEL ?? '').trim(),
    imageModel: (process.env.AI_IMAGE_MODEL ?? '').trim(),
    imageProvider: (process.env.AI_IMAGE_PROVIDER ?? '').trim().toLowerCase(),
    huggingface: {
      token: (process.env.HF_TOKEN ?? '').trim(),
      imageModel: (
        process.env.HF_IMAGE_MODEL ?? 'black-forest-labs/FLUX.1-Kontext-dev'
      ).trim(),
      provider: (process.env.HF_IMAGE_PROVIDER ?? 'auto').trim().toLowerCase(),
      endpointUrl: (process.env.HF_IMAGE_ENDPOINT_URL ?? '').trim(),
      spaceUrl: (
        process.env.HF_SPACE_URL ??
        'https://nick088-real-esrgan-pytorch.hf.space'
      ).trim(),
      spaceApiName: (process.env.HF_SPACE_API_NAME ?? 'predict').trim(),
      spaceScale: Number(process.env.HF_SPACE_SCALE ?? 4),
    },
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 45000),
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'disk',
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
      signedSeconds: Number(process.env.CLOUDINARY_SIGNED_URL_TTL ?? 600),
    },
  },
});
