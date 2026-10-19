import { InjectionToken } from '@angular/core';

/** Auth0 settings of the portal's public SPA client (ADR-0006); not secrets. */
export interface AuthConfig {
  /** Auth0 tenant domain without scheme, for example `esi-demo.eu.auth0.com`. */
  readonly domain: string;
  /** Client ID of the Auth0 Single Page Application. */
  readonly clientId: string;
  /** Identifier of the Auth0 API for core; without it Auth0 issues tokens core cannot validate. */
  readonly audience: string;
}

/** Runtime configuration, loaded from `/config.json` at start (written by the container from env vars). */
export interface AppConfig {
  /** Base URL of `services/core-backend`, used by the API client. */
  readonly apiBaseUrl: string;
  /**
   * Sign-in through Auth0. Absent means sign-in is off: local development against a core in `LocalAdmin` mode.
   * A core in `Oidc` mode answers 401 to every request without it.
   */
  readonly auth?: AuthConfig;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// A host name only: no scheme, path, port or spaces.
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

/** Validates the parsed `/config.json`; throws so a broken deployment fails loudly at start. */
export function parseAppConfig(value: unknown): AppConfig {
  if (typeof value !== 'object' || value === null) {
    throw new Error('config.json must contain a JSON object');
  }
  const { apiBaseUrl, auth } = value as Record<string, unknown>;
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.length === 0) {
    throw new Error('config.json: "apiBaseUrl" must be a non-empty string');
  }
  return auth === undefined ? { apiBaseUrl } : { apiBaseUrl, auth: parseAuthConfig(auth) };
}

function parseAuthConfig(value: unknown): AuthConfig {
  if (typeof value !== 'object' || value === null) {
    throw new Error('config.json: "auth" must be an object when present');
  }
  const { domain, clientId, audience } = value as Record<string, unknown>;
  for (const [key, field] of Object.entries({ domain, clientId, audience })) {
    if (typeof field !== 'string' || field.trim().length === 0) {
      throw new Error(`config.json: "auth.${key}" must be a non-empty string`);
    }
  }
  if (!DOMAIN.test(domain as string)) {
    throw new Error('config.json: "auth.domain" must be a host name without scheme, for example tenant.eu.auth0.com');
  }
  return { domain: domain as string, clientId: clientId as string, audience: audience as string };
}

/** Fetches and validates the runtime configuration before the app bootstraps. */
export async function loadAppConfig(fetchFn: typeof fetch = fetch, url = '/config.json'): Promise<AppConfig> {
  const response = await fetchFn(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`could not load ${url}: HTTP ${response.status}`);
  }
  return parseAppConfig(await response.json());
}
