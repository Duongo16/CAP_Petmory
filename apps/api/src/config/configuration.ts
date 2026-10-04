/**
 * Reads configuration from environment variables. Secrets are never hard coded.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  webOrigin: string;
  sepayWebhookKey: string;
  sepay: {
    /** Token goi API giao dich cua SePay, dung cho doi soat. Rong thi tat doi soat. */
    apiToken: string;
    apiBase: string;
    /** IP duoc phep goi webhook, cach nhau dau phay. Rong thi khong kiem IP. */
    allowedIps: string[];
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
  // Khong co gia tri mac dinh: thieu khoa thi webhook tu choi moi yeu cau.
  sepayWebhookKey: (process.env.SEPAY_WEBHOOK_KEY ?? '').trim(),
  sepay: {
    apiToken: (process.env.SEPAY_API_TOKEN ?? '').trim(),
    apiBase: (process.env.SEPAY_API_BASE ?? 'https://my.sepay.vn/userapi').replace(/\/+$/, ''),
    allowedIps: (process.env.SEPAY_ALLOWED_IPS ?? '')
      .split(',')
      .map((one) => one.trim())
      .filter(Boolean),
    timeoutMs: Number(process.env.SEPAY_TIMEOUT_MS ?? 10000),
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
