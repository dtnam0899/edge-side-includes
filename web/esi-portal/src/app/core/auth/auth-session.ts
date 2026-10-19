import { Signal } from '@angular/core';
import { Observable } from 'rxjs';

/** What the shell shows of the signed-in user. */
export interface AuthUser {
  readonly displayName: string;
}

/** Path of the unguarded page that Auth0 returns to after sign-out and that shows sign-in errors. */
export const SIGNED_OUT_PATH = '/signed-out';

/**
 * The portal's view of sign-in, provided by `provideAuth`. Only `core/` uses it (shell, guard, signed-out page);
 * feature modules never see auth and keep calling their `apis/` layer, which the interceptor authenticates.
 */
export abstract class AuthSession {
  /** False when `/config.json` has no `auth` (local development against a `LocalAdmin` core). */
  abstract readonly enabled: boolean;
  /** The signed-in user; null while signed out, while loading, or when sign-in is off. */
  abstract readonly user: Signal<AuthUser | null>;
  /** The last sign-in error as readable text, for the signed-out page. */
  abstract readonly error: Signal<string | null>;
  /** Route guard decision for `returnUrl`: true when allowed, otherwise redirects (to sign-in or the error page). */
  abstract allow(returnUrl: string): Observable<boolean | string>;
  /** Starts the sign-in redirect; after sign-in the user lands on the portal's start page. */
  abstract signIn(): void;
  abstract signOut(): void;
}
