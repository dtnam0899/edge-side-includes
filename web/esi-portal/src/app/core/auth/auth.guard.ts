import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthSession } from './auth-session';

/** Lets signed-in users through; sends everyone else to Auth0 Universal Login. Open when sign-in is off. */
export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AuthSession)
    .allow(state.url)
    .pipe(map((result) => (typeof result === 'string' ? router.parseUrl(result) : result)));
};
