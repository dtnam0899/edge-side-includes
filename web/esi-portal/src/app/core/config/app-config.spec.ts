import { loadAppConfig, parseAppConfig } from './app-config';

describe('parseAppConfig', () => {
  it('accepts a valid config', () => {
    expect(parseAppConfig({ apiBaseUrl: '/api' })).toEqual({ apiBaseUrl: '/api' });
  });

  it.each([null, 'x', {}, { apiBaseUrl: '' }, { apiBaseUrl: 1 }])('rejects %j', (value) => {
    expect(() => parseAppConfig(value)).toThrow();
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
