import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Auth0ClientService, AuthState } from '@auth0/auth0-angular';

import { FakeAuthSession, fakeAuth0Client, provideFakeAuthSession } from '../../../testing/auth-testing';
import { authGuard } from './auth.guard';
import { provideAuth } from './provide-auth';

@Component({ selector: 'app-protected', template: '<h1>Protected</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class ProtectedPage {}

@Component({ selector: 'app-signed-out', template: '<h1>Signed out</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class SignedOut {}

const routes = [
  { path: 'signed-out', component: SignedOut },
  { path: 'protected', component: ProtectedPage, canActivate: [authGuard] },
];

const auth = { domain: 'esi-demo.eu.auth0.com', clientId: 'abc123', audience: 'https://api.esi.demo' };

function setUpAuth0(signedIn: boolean) {
  const client = fakeAuth0Client({ signedIn });
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      ...provideAuth({ apiBaseUrl: '/api', auth }),
      { provide: Auth0ClientService, useValue: client },
    ],
  });
  return client;
}

describe('authGuard with Auth0', () => {
  it('lets a signed-in user through', async () => {
    setUpAuth0(true);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(harness.routeNativeElement?.textContent).toBe('Protected');
  });

  it('sends a signed-out user to Auth0 with the requested URL as the return target', async () => {
    const client = setUpAuth0(false);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected?tab=chat');
    expect(harness.routeNativeElement?.textContent).not.toBe('Protected');
    expect(client.loginWithRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ appState: { target: '/protected?tab=chat' } }),
    );
  });

  it('sends a user whose sign-in failed to the signed-out page instead of back to Auth0', async () => {
    const client = setUpAuth0(false);
    const harness = await RouterTestingHarness.create();
    // What the SDK records when the Auth0 callback carries an error, for example a blocked user.
    TestBed.inject(AuthState).setError({ error: 'access_denied', error_description: 'user is blocked' });
    await harness.navigateByUrl('/protected');
    expect(harness.routeNativeElement?.textContent).toBe('Signed out');
    expect(client.loginWithRedirect).not.toHaveBeenCalled();
  });
});

describe('authGuard without Auth0', () => {
  it('lets everyone through when sign-in is off', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), ...provideAuth({ apiBaseUrl: '/api' })] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(harness.routeNativeElement?.textContent).toBe('Protected');
  });

  it('follows the session decision', async () => {
    const session = new FakeAuthSession();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideFakeAuthSession(session)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(harness.routeNativeElement?.textContent).not.toBe('Protected');
  });
});
