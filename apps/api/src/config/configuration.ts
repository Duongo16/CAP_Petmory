/**
 * Reads configuration from environment variables. Secrets are never hard coded.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  webOrigin: string;
  sepayWebhookKey: string;
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
    apiKey: string;
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
  sepayWebhookKey: process.env.SEPAY_WEBHOOK_KEY ?? 'change-this-key-before-running',
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
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'claude-opus-5',
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
