export interface AppConfig {
  nodeEnv: string;
  port: number;
  swaggerEnabled: boolean;
  /**
   * Browser origins allowed to call the API cross-site. Empty in the standard
   * deploy, where nginx puts the web app and the API on one origin and CORS
   * never enters the picture; set when the frontend lives on its own domain.
   */
  corsOrigins: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicUrl: string;
}

export interface JwtConfig {
  accessSecret: string;
  accessTtl: string;
  refreshSecret: string;
  refreshTtl: string;
}

export interface SmsConfig {
  provider: 'mock' | 'eskiz';
  eskizEmail: string;
  eskizPassword: string;
  eskizBaseUrl: string;
  eskizFrom: string;
}

export interface PushConfig {
  provider: 'mock' | 'fcm';
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface AiConfig {
  /**
   * `local` needs no credentials and no network — it is the default, and it is
   * what `anthropic` degrades to when the key is missing or the API is down.
   */
  provider: 'local' | 'anthropic';

  /** Drafting a whole listing: the harder task, worth the better model. */
  anthropicModel: string;
  /** Category classification and Q&A: short, frequent, cost-sensitive. */
  anthropicFastModel: string;
  anthropicApiKey: string;

  /** OpenAI-compatible endpoint, still used for voice transcription. */
  baseUrl: string;
  apiKey: string;
  model: string;
  transcribeModel: string;
}

const toBool = (value?: string, fallback = false): boolean =>
  value === undefined ? fallback : ['true', '1', 'yes'].includes(value.toLowerCase());

/** Comma-separated origins, trailing slashes trimmed — the Origin header has none. */
const toOrigins = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    swaggerEnabled: toBool(process.env.SWAGGER_ENABLED, true),
    corsOrigins: toOrigins(process.env.CORS_ORIGINS),
  } satisfies AppConfig,
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'agromagnat',
    password: process.env.DB_PASSWORD ?? 'agromagnat',
    database: process.env.DB_NAME ?? 'agromagnat',
    synchronize: toBool(process.env.DB_SYNCHRONIZE, false),
    logging: toBool(process.env.DB_LOGGING, false),
  } satisfies DatabaseConfig,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB ?? '0', 10),
  } satisfies RedisConfig,
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'agromagnat',
    accessKey: process.env.S3_ACCESS_KEY ?? 'agromagnat',
    secretKey: process.env.S3_SECRET_KEY ?? 'agromagnat',
    publicUrl: process.env.S3_PUBLIC_URL ?? 'http://localhost:9000/agromagnat',
  } satisfies S3Config,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  } satisfies JwtConfig,
  sms: {
    provider: (process.env.SMS_PROVIDER ?? 'mock') as 'mock' | 'eskiz',
    eskizEmail: process.env.ESKIZ_EMAIL ?? '',
    eskizPassword: process.env.ESKIZ_PASSWORD ?? '',
    eskizBaseUrl: process.env.ESKIZ_BASE_URL ?? 'https://notify.eskiz.uz/api',
    eskizFrom: process.env.ESKIZ_FROM ?? '4546',
  } satisfies SmsConfig,
  push: {
    provider: (process.env.PUSH_PROVIDER ?? 'mock') as 'mock' | 'fcm',
    projectId: process.env.FCM_PROJECT_ID ?? '',
    clientEmail: process.env.FCM_CLIENT_EMAIL ?? '',
    privateKey: process.env.FCM_PRIVATE_KEY ?? '',
  } satisfies PushConfig,
  ai: {
    provider: (process.env.AI_PROVIDER ?? 'local') as 'local' | 'anthropic',
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
    anthropicFastModel: process.env.ANTHROPIC_FAST_MODEL ?? 'claude-haiku-4-5',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    transcribeModel: process.env.AI_TRANSCRIBE_MODEL ?? 'whisper-1',
  } satisfies AiConfig,
});
