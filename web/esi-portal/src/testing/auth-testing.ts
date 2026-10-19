import { Provider, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';

import { AuthSession, AuthUser } from '../app/core/auth';

/** An `AuthSession` whose state tests set directly; records sign-in and sign-out calls. */
export class FakeAuthSession extends AuthSession {
  enabled = true;
  readonly user = signal<AuthUser | null>(null);
  readonly error = signal<string | null>(null);
  readonly signIn = vi.fn<() => void>();
  readonly signOut = vi.fn<() => void>();

  allow(): Observable<boolean> {
    return of(this.user() !== null || !this.enabled);
  }
}

export function provideFakeAuthSession(session: AuthSession = new FakeAuthSession()): Provider {
  return { provide: AuthSession, useValue: session };
}

/** A stand-in for the Auth0 SPA client (`Auth0ClientService`), so tests never reach an Auth0 tenant. */
export function fakeAuth0Client(options: { signedIn: boolean; token?: string }) {
  return {
    checkSession: vi.fn(async () => undefined),
    isAuthenticated: vi.fn(async () => options.signedIn),
    getUser: vi.fn(async () => (options.signedIn ? { name: 'Ada Lovelace', email: 'ada@example.test' } : undefined)),
    getIdTokenClaims: vi.fn(async () => undefined),
    getTokenSilently: vi.fn(async () => options.token ?? 'test-access-token'),
    loginWithRedirect: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
}
