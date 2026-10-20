import { loadAppConfig, parseAppConfig } from './app-config';

const auth = { domain: 'esi-demo.eu.auth0.com', clientId: 'abc123', audience: 'https://api.esi.demo' };

describe('parseAppConfig', () => {
  it('accepts a valid config', () => {
    expect(parseAppConfig({ apiBaseUrl: '/api' })).toEqual({ apiBaseUrl: '/api' });
  });

  it.each([null, 'x', {}, { apiBaseUrl: '' }, { apiBaseUrl: 1 }])('rejects %j', (value) => {
    expect(() => parseAppConfig(value)).toThrow();
  });

  it('accepts complete auth settings', () => {
    expect(parseAppConfig({ apiBaseUrl: '/api', auth })).toEqual({ apiBaseUrl: '/api', auth });
  });

  it('leaves sign-in off when auth is absent', () => {
    expect(parseAppConfig({ apiBaseUrl: '/api' }).auth).toBeUndefined();
  });

  it('drops unknown auth fields', () => {
    expect(parseAppConfig({ apiBaseUrl: '/api', auth: { ...auth, secret: 'x' } }).auth).toEqual(auth);
  });

  it.each([
    ['null', null],
    ['a string', 'esi-demo.eu.auth0.com'],
    ['an empty object', {}],
    ['a missing domain', { clientId: auth.clientId, audience: auth.audience }],
    ['a missing client ID', { domain: auth.domain, audience: auth.audience }],
    ['a missing audience', { domain: auth.domain, clientId: auth.clientId }],
    ['a blank audience', { ...auth, audience: ' ' }],
    ['a numeric client ID', { ...auth, clientId: 1 }],
    ['a domain with scheme', { ...auth, domain: 'https://esi-demo.eu.auth0.com' }],
    ['a domain with path', { ...auth, domain: 'esi-demo.eu.auth0.com/' }],
    ['a single-label domain', { ...auth, domain: 'localhost' }],
  ])('rejects auth with %s', (_, value) => {
    expect(() => parseAppConfig({ apiBaseUrl: '/api', auth: value })).toThrow(/auth/);
  });
});

describe('loadAppConfig', () => {
  it('fetches and parses the config', async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ apiBaseUrl: 'https://api.example' }))) as typeof fetch;
    await expect(loadAppConfig(fetchFn)).resolves.toEqual({ apiBaseUrl: 'https://api.example' });
  });

  it('fails on an HTTP error', async () => {
    const fetchFn = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(loadAppConfig(fetchFn)).rejects.toThrow('HTTP 404');
  });
});
