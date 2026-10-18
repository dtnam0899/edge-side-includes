import { HttpClient, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';

/** Options every generated `*Request` builder accepts; `CoreApi` fills them in. */
export interface RequestTarget {
  readonly baseUrl: string;
  readonly httpClient: HttpClient;
}

/**
 * Sends requests built by the generated core-api client (`generated/@angular/common.gen.ts`) through Angular
 * `HttpClient`, so interceptors and `HttpTestingController` apply. Errors stay `HttpErrorResponse`; use
 * `toApiProblem` to read them.
 */
@Injectable({ providedIn: 'root' })
export class CoreApi {
  private readonly http = inject(HttpClient);
  private readonly target: RequestTarget = {
    baseUrl: inject(APP_CONFIG).apiBaseUrl.replace(/\/+$/, ''),
    httpClient: this.http,
  };

  send<T>(build: (target: RequestTarget) => HttpRequest<T>): Observable<T> {
    return this.http.request<T>(build(this.target)).pipe(
      filter((event): event is HttpResponse<T> => event instanceof HttpResponse),
      map((response) => response.body as T),
    );
  }
}
