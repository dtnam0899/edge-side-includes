import { DOCUMENT, Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService, User } from '@auth0/auth0-angular';
import { Observable, map, of, switchMap, take } from 'rxjs';

import { AuthSession, AuthUser, SIGNED_OUT_PATH } from './auth-session';

/** Sign-in through Auth0 Universal Login (`@auth0/auth0-angular`); tokens stay in memory. */
@Injectable()
export class Auth0Session extends AuthSession {
  private readonly auth = inject(AuthService);
  private readonly origin = inject(DOCUMENT).location.origin;

  readonly enabled = true;
  readonly user = toSignal(this.auth.user$.pipe(map(toAuthUser)), { initialValue: null });
  readonly error = toSignal(this.auth.error$.pipe(map(describeError)), { initialValue: null });

  allow(returnUrl: string): Observable<boolean | string> {
    return this.auth.isAuthenticated$.pipe(
      take(1),
      switchMap((signedIn) => {
        if (signedIn) return of(true);
        // A failed sign-in (for example a blocked user) goes to the error page instead of looping through Auth0.
        if (this.error()) return of(SIGNED_OUT_PATH);
        return this.auth.loginWithRedirect({ appState: { target: returnUrl } }).pipe(map(() => false));
      }),
    );
  }

  signIn(): void {
    this.auth.loginWithRedirect({ appState: { target: '/' } }).subscribe();
  }

  signOut(): void {
    this.auth.logout({ logoutParams: { returnTo: this.origin + SIGNED_OUT_PATH } }).subscribe();
  }
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  return { displayName: user.name || user.email || user.nickname || 'Signed in' };
}

function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const { error_description: description, message } = error as { error_description?: unknown; message?: unknown };
    if (typeof description === 'string' && description) return description;
    if (typeof message === 'string' && message) return message;
  }
  return 'Sign-in failed.';
}
