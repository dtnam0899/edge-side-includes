import { InjectionToken } from '@angular/core';

/** Runtime configuration, loaded from `/config.json` at start (written by the container from env vars). */
export interface AppConfig {
  /** Base URL of `services/core-backend`, used by the API client. */
  readonly apiBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/** Validates the parsed `/config.json`; throws so a broken deployment fails loudly at start. */
export function parseAppConfig(value: unknown): AppConfig {
  if (typeof value !== 'object' || value === null) {
    throw new Error('config.json must contain a JSON object');
  }
  const { apiBaseUrl } = value as Record<string, unknown>;
  if (typeof apiBaseUrl !== 'string' || apiBaseUrl.length === 0) {
    throw new Error('config.json: "apiBaseUrl" must be a non-empty string');
  }
  return { apiBaseUrl };
}

/** Fetches and validates the runtime configuration before the app bootstraps. */
export async function loadAppConfig(fetchFn: typeof fetch = fetch, url = '/config.json'): Promise<AppConfig> {
  const response = await fetchFn(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`could not load ${url}: HTTP ${response.status}`);
  }
  return parseAppConfig(await response.json());
}
