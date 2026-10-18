import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '../app/core/config/app-config';

export const TEST_API_BASE_URL = '/api';

/** HttpClient with the testing backend and the runtime config the core-api client needs. */
export function provideCoreApiTesting(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    { provide: APP_CONFIG, useValue: { apiBaseUrl: TEST_API_BASE_URL } },
  ];
}

export function httpTesting(): HttpTestingController {
  return TestBed.inject(HttpTestingController);
}

/** Problem response options for `TestRequest.flush`. */
export function problemResponse(status: number): {
  status: number;
  statusText: string;
  headers: Record<string, string>;
} {
  return { status, statusText: 'Error', headers: { 'content-type': 'application/problem+json' } };
}
