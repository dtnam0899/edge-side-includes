import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FakeAuthSession, provideFakeAuthSession } from '../../../testing/auth-testing';
import { Shell } from './shell';

async function render(session = new FakeAuthSession()): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [Shell],
    providers: [provideRouter([]), provideFakeAuthSession(session)],
  }).compileComponents();
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function button(el: HTMLElement, name: string): HTMLButtonElement | undefined {
  return [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
}

describe('Shell', () => {
  it('renders the primary navigation and a main landmark', async () => {
    const el = await render();
    expect(el.querySelector('nav[aria-label="Primary"] a')?.textContent?.trim()).toBe('AI assistant');
    expect(el.querySelector('main#main')).not.toBeNull();
  });

  it('shows the signed-in user and signs out', async () => {
    const session = new FakeAuthSession();
    session.user.set({ displayName: 'Ada Lovelace' });
    const el = await render(session);
    expect(el.querySelector('.shell-user')?.textContent).toBe('Signed in as Ada Lovelace');
    button(el, 'Sign out')?.click();
    expect(session.signOut).toHaveBeenCalled();
  });

  it('shows no account controls while signed out (the signed-out page offers sign-in)', async () => {
    const el = await render(new FakeAuthSession());
    expect(el.querySelector('.shell-account')).toBeNull();
  });

  it('shows no account controls when sign-in is off', async () => {
    const session = new FakeAuthSession();
    session.enabled = false;
    const el = await render(session);
    expect(el.querySelector('.shell-account')).toBeNull();
  });
});
