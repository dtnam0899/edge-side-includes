import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

import { AuthSession, AuthUser } from './auth-session';

/** Sign-in off: every route is open and requests carry no token (core decides who the user is, `LocalAdmin`). */
@Injectable()
export class LocalAuthSession extends AuthSession {
  readonly enabled = false;
  readonly user = signal<AuthUser | null>(null).asReadonly();
  readonly error = signal<string | null>(null).asReadonly();

  allow(): Observable<boolean> {
    return of(true);
  }

  signIn(): void {
    // Nothing to sign in to.
  }

  signOut(): void {
    // Nothing to sign out of.
  }
}
