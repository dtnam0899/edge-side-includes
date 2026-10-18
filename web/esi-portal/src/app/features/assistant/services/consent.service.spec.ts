import { TestBed } from '@angular/core/testing';

import {
  httpTesting,
  problemResponse,
  provideCoreApiTesting,
} from '../../../../testing/core-api-testing';
import {
  mockConsentAcceptance,
  mockConsentTerms,
  mockProblem,
} from '../../../../testing/mocks/core-api.mocks';
import { ConsentService } from './consent.service';

describe('ConsentService', () => {
  let consent: ConsentService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConsentService, ...provideCoreApiTesting()] });
    consent = TestBed.inject(ConsentService);
  });

  afterEach(() => httpTesting().verify());

  function load(acceptance: object | null): void {
    consent.load();
    httpTesting().expectOne('/api/consent/terms').flush(mockConsentTerms());
    const request = httpTesting().expectOne('/api/consent/acceptance');
    if (acceptance) {
      request.flush(acceptance);
    } else {
      request.flush(mockProblem('not-found', 404), problemResponse(404));
    }
  }

  it('treats a missing acceptance as not accepted and opens the terms on demand', () => {
    load(null);
    expect(consent.isAccepted()).toBe(false);

    let decision: boolean | undefined;
    consent.ensureAccepted().subscribe((accepted) => (decision = accepted));
    expect(consent.dialogOpen()).toBe(true);

    consent.accept();
    const request = httpTesting().expectOne({ method: 'POST', url: '/api/consent/acceptance' });
    expect(request.request.body).toEqual({ termsVersion: '2026-10-18.1' });
    request.flush(mockConsentAcceptance());

    expect(decision).toBe(true);
    expect(consent.dialogOpen()).toBe(false);
    expect(consent.isAccepted()).toBe(true);
  });

  it('requires accepting again when the terms changed', () => {
    load(mockConsentAcceptance({ termsVersion: '2026-01-01.1', isCurrent: false }));
    expect(consent.isOutdated()).toBe(true);
    expect(consent.isAccepted()).toBe(false);
  });

  it('passes straight through when the current terms are accepted', () => {
    load(mockConsentAcceptance());
    let decision: boolean | undefined;
    consent.ensureAccepted().subscribe((accepted) => (decision = accepted));
    expect(decision).toBe(true);
    expect(consent.dialogOpen()).toBe(false);
  });

  it('resolves false when the user cancels', () => {
    load(null);
    let decision: boolean | undefined;
    consent.ensureAccepted().subscribe((accepted) => (decision = accepted));
    consent.dismiss();
    expect(decision).toBe(false);
  });
});
