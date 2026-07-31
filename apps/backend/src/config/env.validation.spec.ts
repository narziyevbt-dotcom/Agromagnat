import {
  DEV_JWT_ACCESS_SECRET,
  DEV_JWT_REFRESH_SECRET,
  envValidationSchema,
} from './env.validation';

/**
 * These are not configuration tests. They are the guard around the one class of
 * mistake that ends the company: a production deployment that boots with a
 * development placeholder.
 *
 * `role` rides inside the access token and `RolesGuard` trusts it, so whoever
 * holds the signing secret can mint an administrator. This repository is
 * public, so the development secret is public. A server that started with it
 * would be fully compromised by anyone who read the source — no exploit, no
 * unusual traffic, nothing in the logs. One forgotten line in a hand-copied
 * `.env` was all it took.
 */
const SAFE_PRODUCTION = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
  SMS_PROVIDER: 'eskiz',
  ESKIZ_EMAIL: 'ops@agromagnat.uz',
  ESKIZ_PASSWORD: 'secret',
};

const validate = (env: Record<string, unknown>) => envValidationSchema.validate(env);

describe('env validation — production guards', () => {
  it('accepts a correctly configured production environment', () => {
    expect(validate(SAFE_PRODUCTION).error).toBeUndefined();
  });

  it('refuses to boot production with the public development JWT secret', () => {
    const { error } = validate({
      ...SAFE_PRODUCTION,
      JWT_ACCESS_SECRET: DEV_JWT_ACCESS_SECRET,
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('public');
  });

  it('refuses the development refresh secret too', () => {
    expect(
      validate({ ...SAFE_PRODUCTION, JWT_REFRESH_SECRET: DEV_JWT_REFRESH_SECRET }).error,
    ).toBeDefined();
  });

  it('refuses a short production secret', () => {
    // Long enough to pass a glance, short enough to brute-force offline.
    expect(validate({ ...SAFE_PRODUCTION, JWT_ACCESS_SECRET: 'short' }).error).toBeDefined();
  });

  it('refuses to start production without a JWT secret at all', () => {
    const env: Record<string, unknown> = { ...SAFE_PRODUCTION };
    delete env.JWT_ACCESS_SECRET;

    // Silently defaulting is what made this dangerous: the app booted happily.
    expect(validate(env).error).toBeDefined();
  });

  it('refuses mock SMS in production', () => {
    // mock accepts 000000 for every number — anyone signs in as anyone.
    const { error } = validate({ ...SAFE_PRODUCTION, SMS_PROVIDER: 'mock' });

    expect(error).toBeDefined();
    expect(error!.message).toContain('000000');
  });

  it('demands Eskiz credentials once Eskiz is selected', () => {
    const env: Record<string, unknown> = { ...SAFE_PRODUCTION };
    delete env.ESKIZ_EMAIL;

    // Otherwise the provider is real, the credentials are blank, and every OTP
    // silently fails to send — which looks like nobody can register.
    expect(validate(env).error).toBeDefined();
  });

  it('refuses schema synchronisation in production', () => {
    // TypeORM's sync drops columns it cannot reconcile, on live listings.
    expect(validate({ ...SAFE_PRODUCTION, DB_SYNCHRONIZE: true }).error).toBeDefined();
  });

  it('leaves Swagger off in production unless asked for', () => {
    expect(validate(SAFE_PRODUCTION).value.SWAGGER_ENABLED).toBe(false);
    expect(
      validate({ ...SAFE_PRODUCTION, SWAGGER_ENABLED: true }).value.SWAGGER_ENABLED,
    ).toBe(true);
  });
});

describe('env validation — development stays convenient', () => {
  it('needs nothing at all', () => {
    // A fresh clone has to run with an empty env, or the first five minutes of
    // the project are spent reading a config file.
    expect(validate({}).error).toBeUndefined();
  });

  it('defaults to the development secrets and mock SMS', () => {
    const { value } = validate({});

    expect(value.JWT_ACCESS_SECRET).toBe(DEV_JWT_ACCESS_SECRET);
    expect(value.SMS_PROVIDER).toBe('mock');
    expect(value.SWAGGER_ENABLED).toBe(true);
  });

  it('allows the placeholders in test, which is where they belong', () => {
    expect(validate({ NODE_ENV: 'test' }).error).toBeUndefined();
  });
});
