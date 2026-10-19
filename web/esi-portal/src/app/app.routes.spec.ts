import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { FakeAuthSession, provideFakeAuthSession } from '../testing/auth-testing';
import { provideCoreApiTesting } from '../testing/core-api-testing';
import { AuthSession } from './core/auth';
import { LocalAuthSession } from './core/auth/local-auth-session';
import { routes } from './app.routes';

function setUp(session: AuthSession = new LocalAuthSession()): void {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), ...provideCoreApiTesting(), provideFakeAuthSession(session)],
  });
}

describe('app routes', () => {
  it('lazy-loads the assistant module', async () => {
    setUp();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/assistant');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('AI assistant');
  });

  it('redirects unknown URLs to the assistant', async () => {
    setUp();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/does-not-exist');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('AI assistant');
  });

  it('keeps the assistant behind sign-in', async () => {
    setUp(new FakeAuthSession());
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/assistant');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).not.toBe('AI assistant');
  });

  it('leaves the signed-out page open', async () => {
    setUp(new FakeAuthSession());
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/signed-out');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('You are signed out');
  });
});
