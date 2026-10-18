import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ConsentAcceptance,
  ConsentTerms,
  CoreApi,
  acceptConsentTermsRequest,
  getConsentAcceptanceRequest,
  getConsentTermsRequest,
} from '../../../core/api';

/** HTTP boundary for the consent terms and the user's acceptance. */
@Injectable({ providedIn: 'root' })
export class ConsentApi {
  private readonly api = inject(CoreApi);

  getTerms(): Observable<ConsentTerms> {
    return this.api.send((target) => getConsentTermsRequest(target));
  }

  /** Errors with `not-found` when the user never accepted any version. */
  getAcceptance(): Observable<ConsentAcceptance> {
    return this.api.send((target) => getConsentAcceptanceRequest(target));
  }

  accept(termsVersion: string): Observable<ConsentAcceptance> {
    return this.api.send((target) =>
      acceptConsentTermsRequest({ ...target, body: { termsVersion } }),
    );
  }
}
