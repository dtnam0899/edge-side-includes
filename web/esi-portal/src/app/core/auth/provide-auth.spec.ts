import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth0ClientService, AuthClientConfig } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';

import { fakeAuth0Client } from '../../../testing/auth-testing';
import { AppConfig } from '../config/app-config';
import { AuthSession } from './auth-session';
import { apiUrlPattern, authInterceptors, provideAuth } from './provide-auth';

const auth = { domain: 'esi-demo.eu.auth0.com', clientId: 'abc123', audience: 'https://api.esi.demo' };

function setUp(config: AppConfig, client = fakeAuth0Client({ signedIn: true })) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors(authInterceptors(config))),
      provideHttpClientTesting(),
      ...provideAuth(config),
      ...(config.auth ? [{ provide: Auth0ClientService, useValue: client }] : []),
    ],
  });
  return { http: TestBed.inject(HttpClient), backend: TestBed.inject(HttpTestingController), client };
}

async function authorizationOf(backend: HttpTestingController, url: string): Promise<string | null> {
  // The interceptor waits for the SDK to load before it asks for a token.
  const request = await vi.waitFor(() => backend.expectOne(url));
  request.flush({});
  return request.request.headers.get('Authorization');
}

describe('provideAuth with Auth0 settings', () => {
  const config: AppConfig = { apiBaseUrl: '/api', auth };

  it('attaches the access token to apiBaseUrl requests', async () => {
    const { http, backend } = setUp(config);
    http.get('/api/connections').subscribe();
    await expect(authorizationOf(backend, '/api/connections')).resolves.toBe('Bearer test-access-token');
  });

  it.each(['/config.json', '/apiary/x', 'https://esi-demo.eu.auth0.com/userinfo', 'https://elsewhere.example/api/x'])(
    'sends no token to %s',
    async (url) => {
      const { http, backend, client } = setUp(config);
      http.get(url).subscribe();
      await expect(authorizationOf(backend, url)).resolves.toBeNull();
      expect(client.getTokenSilently).not.toHaveBeenCalled();
    },
  );

  it('attaches the token to an absolute apiBaseUrl only', async () => {
    const { http, backend } = setUp({ apiBaseUrl: 'https://core.example.test/', auth });
    http.get('https://core.example.test/connections').subscribe();
    http.get('https://core.example.test.evil.example/connections').subscribe();
    await expect(authorizationOf(backend, 'https://core.example.test/connections')).resolves.toBe(
      'Bearer test-access-token',
    );
    await expect(authorizationOf(backend, 'https://core.example.test.evil.example/connections')).resolves.toBeNull();
  });

  it('asks Auth0 for the API audience and returns to the signed-out page after sign-out', async () => {
    const { client } = setUp(config);
    const session = TestBed.inject(AuthSession);
    expect(session.enabled).toBe(true);
    expect(TestBed.inject(AuthClientConfig).get()).toMatchObject({
      domain: auth.domain,
      clientId: auth.clientId,
      useRefreshTokens: true,
      authorizationParams: { audience: auth.audience, redirect_uri: location.origin },
    });
    session.signOut();
    await vi.waitFor(() => expect(client.logout).toHaveBeenCalled());
    expect(client.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: `${location.origin}/signed-out` } });
  });
});

describe('provideAuth without Auth0 settings', () => {
  const config: AppConfig = { apiBaseUrl: '/api' };

  it('turns sign-in off and sends requests without a token', async () => {
    const { http, backend } = setUp(config);
    expect(TestBed.inject(AuthSession).enabled).toBe(false);
    await expect(firstValueFrom(TestBed.inject(AuthSession).allow('/assistant'))).resolves.toBe(true);
    http.get('/api/connections').subscribe();
    await expect(authorizationOf(backend, '/api/connections')).resolves.toBeNull();
    backend.verify();
  });

  it('registers no interceptor', () => {
    expect(authInterceptors(config)).toEqual([]);
  });
});

describe('apiUrlPattern', () => {
  it.each([
    ['/api', '/api/*'],
    ['/api/', '/api/*'],
    ['https://core.example.test', 'https://core.example.test/*'],
  ])('%s gives %s', (base, pattern) => {
    expect(apiUrlPattern(base)).toBe(pattern);
  });
});
