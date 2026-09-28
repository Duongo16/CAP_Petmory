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
});
