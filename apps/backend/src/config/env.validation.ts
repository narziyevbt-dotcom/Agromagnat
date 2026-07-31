import * as Joi from 'joi';

/**
 * Every variable the backend needs, validated at boot.
 * The app refuses to start on a missing or malformed value — a bad env is a
 * deploy-time failure, never a runtime surprise.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  // Postgres
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().default('agromagnat'),
  DB_PASSWORD: Joi.string().default('agromagnat'),
  DB_NAME: Joi.string().default('agromagnat'),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(false),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().min(0).default(0),

  // S3 / MinIO
  S3_ENDPOINT: Joi.string().default('http://localhost:9000'),
  S3_REGION: Joi.string().default('us-east-1'),
  S3_BUCKET: Joi.string().default('agromagnat'),
  S3_ACCESS_KEY: Joi.string().default('agromagnat'),
  S3_SECRET_KEY: Joi.string().default('agromagnat'),
  S3_PUBLIC_URL: Joi.string().default('http://localhost:9000/agromagnat'),

  // Auth — real secrets are required in production only
  JWT_ACCESS_SECRET: Joi.string().default('dev-access-secret-change-me'),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().default('dev-refresh-secret-change-me'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  // SMS (Eskiz.uz) — mocked in dev
  SMS_PROVIDER: Joi.string().valid('mock', 'eskiz').default('mock'),
  ESKIZ_EMAIL: Joi.string().allow('').default(''),
  ESKIZ_PASSWORD: Joi.string().allow('').default(''),
  ESKIZ_BASE_URL: Joi.string().default('https://notify.eskiz.uz/api'),
  ESKIZ_FROM: Joi.string().default('4546'),

  // Push (Firebase Cloud Messaging) — mocked in dev.
  // The FCM_* values come from a service-account JSON key; the private key keeps
  // its literal \n escapes in the env file and is unescaped before signing.
  PUSH_PROVIDER: Joi.string().valid('mock', 'fcm').default('mock'),
  FCM_PROJECT_ID: Joi.string().allow('').default(''),
  FCM_CLIENT_EMAIL: Joi.string().allow('').default(''),
  FCM_PRIVATE_KEY: Joi.string().allow('').default(''),

  // AI (OpenAI-compatible)
  AI_BASE_URL: Joi.string().default('https://api.openai.com/v1'),
  AI_API_KEY: Joi.string().allow('').default(''),
  AI_MODEL: Joi.string().default('gpt-4o-mini'),
  AI_TRANSCRIBE_MODEL: Joi.string().default('whisper-1'),

  // Swagger
  SWAGGER_ENABLED: Joi.boolean().default(true),
});
