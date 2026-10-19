import { HttpInterceptorFn } from '@angular/common/http';
import { EnvironmentProviders, Provider, inject, provideAppInitializer } from '@angular/core';
import { authHttpInterceptorFn, provideAuth0 } from '@auth0/auth0-angular';

import { AppConfig } from '../config/app-config';
import { Auth0Session } from './auth0-session';
import { AuthSession, SIGNED_OUT_PATH } from './auth-session';
import { LocalAuthSession } from './local-auth-session';

/**
 * Sign-in providers for the runtime config (ADR-0006). With `auth`: Auth0 with PKCE, the API audience and
 * rotating refresh tokens in the default in-memory cache. Without `auth`: sign-in off (`LocalAuthSession`).
 */
export function provideAuth(config: AppConfig): (Provider | EnvironmentProviders)[] {
  if (!config.auth) {
    return [{ provide: AuthSession, useClass: LocalAuthSession }];
  }
  const { domain, clientId, audience } = config.auth;
  return [
    provideAuth0({
      domain,
      clientId,
      authorizationParams: { audience, redirect_uri: window.location.origin },
      useRefreshTokens: true,
      errorPath: SIGNED_OUT_PATH,
      httpInterceptor: { allowedList: [apiUrlPattern(config.apiBaseUrl)] },
    }),
    { provide: AuthSession, useClass: Auth0Session },
    // Created before the first navigation so the SDK reads the `?code=&state=` callback before the router moves on.
    provideAppInitializer(() => {
      inject(AuthSession);
    }),
  ];
}

/** The HTTP interceptors for the runtime config: the Auth0 one attaches tokens to `apiBaseUrl` requests only. */
export function authInterceptors(config: AppConfig): HttpInterceptorFn[] {
  return config.auth ? [authHttpInterceptorFn] : [];
}

/** `<apiBaseUrl>/*`: the SDK matches requests by prefix; the slash keeps `/api` from matching `/api-other`. */
export function apiUrlPattern(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/, '')}/*`;
}
