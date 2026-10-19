import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FakeAuthSession, provideFakeAuthSession } from '../../../../testing/auth-testing';
import { SignedOutPage } from './signed-out-page';

async function render(session: FakeAuthSession): Promise<HTMLElement> {
  TestBed.configureTestingModule({ imports: [SignedOutPage], providers: [provideRouter([]), provideFakeAuthSession(session)] });
  const fixture = TestBed.createComponent(SignedOutPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SignedOutPage', () => {
  it('offers to sign in again after sign-out', async () => {
    const session = new FakeAuthSession();
    const el = await render(session);
    expect(el.querySelector('h1')?.textContent).toBe('You are signed out');
    const button = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Sign in');
    button?.click();
    expect(session.signIn).toHaveBeenCalled();
  });

  it('shows why sign-in failed', async () => {
    const session = new FakeAuthSession();
    session.error.set('user is blocked');
    const el = await render(session);
    expect(el.querySelector('h1')?.textContent).toBe('Sign-in failed');
    expect(el.textContent).toContain('user is blocked');
  });

  it('says sign-in is off when there are no Auth0 settings', async () => {
    const session = new FakeAuthSession();
    session.enabled = false;
    const el = await render(session);
    expect(el.querySelector('h1')?.textContent).toBe('Sign-in is off');
    expect(el.querySelector('button')).toBeNull();
  });
});
