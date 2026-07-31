import configuration from './configuration';

/**
 * The CORS allow-list is the one piece of config with real parsing in it, and
 * getting it wrong fails in the least helpful way possible: a browser blocks
 * the request and the server logs nothing.
 */
describe('configuration — corsOrigins', () => {
  const original = process.env.CORS_ORIGINS;

  const parse = (value?: string): string[] => {
    if (value === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = value;
    }
    return configuration().app.corsOrigins;
  };

  afterAll(() => {
    if (original === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = original;
    }
  });

  it('is empty when unset — the nginx deploy needs no CORS at all', () => {
    expect(parse(undefined)).toEqual([]);
  });

  it('is empty for an empty string rather than one blank origin', () => {
    expect(parse('')).toEqual([]);
  });

  it('splits a comma-separated list', () => {
    expect(parse('https://a.vercel.app,https://agromagnat.uz')).toEqual([
      'https://a.vercel.app',
      'https://agromagnat.uz',
    ]);
  });

  it('tolerates spaces around the separators', () => {
    expect(parse(' https://a.uz , https://b.uz ')).toEqual([
      'https://a.uz',
      'https://b.uz',
    ]);
  });

  it('trims trailing slashes — an Origin header never carries one', () => {
    // Pasted straight from a browser bar this would otherwise never match.
    expect(parse('https://agromagnat.vercel.app/')).toEqual([
      'https://agromagnat.vercel.app',
    ]);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(parse('https://a.uz,,https://b.uz,')).toEqual(['https://a.uz', 'https://b.uz']);
  });
});
