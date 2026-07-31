import * as Joi from 'joi';

/**
 * The development placeholders. Any of these reaching production is a
 * deployment that must not be allowed to start.
 *
 * This list is the whole point of the file. `role` travels inside the access
 * token and `RolesGuard` trusts it, so anyone holding the signing secret can
 * mint themselves an admin. This repository is public, which means the
 * development secret below is public too — a server that booted with it would
 * be fully compromised by anybody who read the source, with no bug to exploit
 * and nothing in the logs to notice. It only ever took one forgotten line in a
 * hand-copied `.env`.
 */
export const DEV_JWT_ACCESS_SECRET = 'dev-access-secret-change-me';
export const DEV_JWT_REFRESH_SECRET = 'dev-refresh-secret-change-me';

/** Shorter than this is brute-forceable offline; 32 bytes of hex is the norm. */
const MIN_PRODUCTION_SECRET = 32;

/**
 * A secret that is generous in development and uncompromising in production.
 *
 * Failing at boot is deliberate. The alternative — warning and continuing — is
 * how a placeholder survives to production: nobody reads a startup log until
 * something is already wrong.
 */
const productionSecret = (devDefault: string) =>
  Joi.string()
    .default(devDefault)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .required()
        .min(MIN_PRODUCTION_SECRET)
        .invalid(DEV_JWT_ACCESS_SECRET, DEV_JWT_REFRESH_SECRET)
        .messages({
          'any.invalid':
            '{{#label}} is still the development placeholder. This repository is public, ' +
            'so that secret is public: generate one with `openssl rand -hex 32`.',
          'string.min': `{{#label}} must be at least ${MIN_PRODUCTION_SECRET} characters in production.`,
          'any.required': '{{#label}} must be set explicitly in production.',
        }),
    });

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
  // Never true in production: TypeORM's schema sync drops columns it cannot
  // reconcile, and it would do that to live listings without asking.
  DB_SYNCHRONIZE: Joi.boolean()
    .default(false)
    .when('NODE_ENV', { is: 'production', then: Joi.boolean().valid(false) }),
  DB_LOGGING: Joi.boolean().default(false),

  // Read by docker-entrypoint.sh, not by the app: seed reference data on boot.
  // For platforms with no shell access; the standard deploy seeds by hand.
  SEED_ON_START: Joi.boolean().default(false),

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
  JWT_ACCESS_SECRET: productionSecret(DEV_JWT_ACCESS_SECRET),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: productionSecret(DEV_JWT_REFRESH_SECRET),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  // SMS (Eskiz.uz) — mocked in dev
  // `mock` accepts 000000 as the code for every number, so in production it
  // means anyone can sign in as anyone — including an administrator. It is the
  // single most dangerous value in this file and cannot be allowed past here.
  //
  // The allowed list lives in the branches, not on the base. Joi's `when`
  // concatenates schemas and merges `valid()` sets rather than intersecting
  // them, so a base of ('mock', 'eskiz') narrowed to ('eskiz') still accepted
  // 'mock' — the guard read correctly and did nothing.
  SMS_PROVIDER: Joi.string()
    .default('mock')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().valid('eskiz').messages({
        'any.only':
          'SMS_PROVIDER=mock accepts 000000 for every phone number. ' +
          'Production must use a real provider.',
      }),
      otherwise: Joi.string().valid('mock', 'eskiz'),
    }),
  ESKIZ_EMAIL: Joi.string()
    .allow('')
    .default('')
    .when('SMS_PROVIDER', { is: 'eskiz', then: Joi.string().required() }),
  ESKIZ_PASSWORD: Joi.string()
    .allow('')
    .default('')
    .when('SMS_PROVIDER', { is: 'eskiz', then: Joi.string().required() }),
  ESKIZ_BASE_URL: Joi.string().default('https://notify.eskiz.uz/api'),
  ESKIZ_FROM: Joi.string().default('4546'),

  // Push (Firebase Cloud Messaging) — mocked in dev.
  // The FCM_* values come from a service-account JSON key; the private key keeps
  // its literal \n escapes in the env file and is unescaped before signing.
  PUSH_PROVIDER: Joi.string().valid('mock', 'fcm').default('mock'),
  FCM_PROJECT_ID: Joi.string().allow('').default(''),
  FCM_CLIENT_EMAIL: Joi.string().allow('').default(''),
  FCM_PRIVATE_KEY: Joi.string().allow('').default(''),

  // Google sign-in. Empty disables the route rather than breaking boot: a
  // deployment without it still works over phone OTP.
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),

  // Telegram OTP delivery and the bot webhook. Empty means SMS only.
  TELEGRAM_BOT_TOKEN: Joi.string().allow('').default(''),
  // Required once a bot exists: without it anyone who guesses the webhook URL
  // can post fake updates and bind their own chat id to somebody's account.
  TELEGRAM_WEBHOOK_SECRET: Joi.string()
    .allow('')
    .default('')
    .when('TELEGRAM_BOT_TOKEN', {
      is: Joi.string().min(1),
      then: Joi.string().min(16).required().messages({
        'any.required':
          'TELEGRAM_WEBHOOK_SECRET is required with a bot token, or anyone who ' +
          'guesses the webhook URL can bind their chat to another account.',
      }),
    }),

  // AI. `local` is keyword-only: no key, no network, no cost — and it is what
  // `anthropic` falls back to when the API cannot be reached.
  AI_PROVIDER: Joi.string().valid('local', 'anthropic').default('local'),
  ANTHROPIC_API_KEY: Joi.string().allow('').default(''),
  ANTHROPIC_MODEL: Joi.string().default('claude-opus-5'),
  ANTHROPIC_FAST_MODEL: Joi.string().default('claude-haiku-4-5'),

  // Voice transcription (OpenAI-compatible)
  AI_BASE_URL: Joi.string().default('https://api.openai.com/v1'),
  AI_API_KEY: Joi.string().allow('').default(''),
  AI_MODEL: Joi.string().default('gpt-4o-mini'),
  AI_TRANSCRIBE_MODEL: Joi.string().default('whisper-1'),

  // Swagger
  // Convenient in development, an annotated map of every endpoint and DTO in
  // production. Opt in explicitly there rather than opt out.
  SWAGGER_ENABLED: Joi.boolean()
    .default(true)
    .when('NODE_ENV', { is: 'production', then: Joi.boolean().default(false) }),

  // Comma-separated browser origins allowed to call the API cross-site.
  // Empty when nginx serves the web app and the API from one origin.
  CORS_ORIGINS: Joi.string().allow('').default(''),
});
