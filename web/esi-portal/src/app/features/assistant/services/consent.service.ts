import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, finalize, forkJoin, of, take, throwError } from 'rxjs';

import { ApiProblem, ConsentAcceptance, ConsentTerms, toApiProblem } from '../../../core/api';
import { ConsentApi } from '../apis/consent.api';

/**
 * Consent terms and the user's acceptance. A connection may be added or used only after the current terms
 * version was accepted; `ensureAccepted()` opens the terms dialog (hosted by the assistant page) when needed.
 */
@Injectable()
export class ConsentService {
  private readonly api = inject(ConsentApi);
  private readonly destroyRef = inject(DestroyRef);
  private pendingDecision: Subject<boolean> | null = null;

  readonly terms = signal<ConsentTerms | null>(null);
  readonly acceptance = signal<ConsentAcceptance | null>(null);
  readonly loading = signal(false);
  readonly loadProblem = signal<ApiProblem | null>(null);

  /** Terms dialog state (rendered by the assistant page). */
  readonly dialogOpen = signal(false);
  readonly accepting = signal(false);
  readonly acceptProblem = signal<ApiProblem | null>(null);

  /** True when an earlier version was accepted and newer terms exist. */
  readonly isOutdated = computed(() => {
    const acceptance = this.acceptance();
    const terms = this.terms();
    return (
      acceptance !== null &&
      (!acceptance.isCurrent || (terms !== null && acceptance.termsVersion !== terms.version))
    );
  });

  readonly isAccepted = computed(() => this.acceptance() !== null && !this.isOutdated());

  load(): void {
    this.loading.set(true);
    this.loadProblem.set(null);
    forkJoin({
      terms: this.api.getTerms(),
      acceptance: this.api
        .getAcceptance()
        .pipe(
          catchError((error: unknown) =>
            toApiProblem(error).status === 404 ? of(null) : throwError(() => error),
          ),
        ),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ terms, acceptance }) => {
          this.terms.set(terms);
          this.acceptance.set(acceptance);
        },
        error: (error: unknown) => this.loadProblem.set(toApiProblem(error)),
      });
  }

  /** Emits true once the current terms are accepted (opening the dialog if needed), false if the user cancels. */
  ensureAccepted(): Observable<boolean> {
    if (this.isAccepted()) {
      return of(true);
    }
    this.pendingDecision?.next(false);
    this.pendingDecision = new Subject<boolean>();
    this.acceptProblem.set(null);
    this.dialogOpen.set(true);
    if (!this.terms()) {
      this.load();
    }
    return this.pendingDecision.pipe(take(1));
  }

  /** Accepts the terms version shown in the dialog. */
  accept(): void {
    const terms = this.terms();
    if (!terms || this.accepting()) {
      return;
    }
    this.accepting.set(true);
    this.acceptProblem.set(null);
    this.api
      .accept(terms.version)
      .pipe(
        finalize(() => this.accepting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (acceptance) => {
          this.acceptance.set(acceptance);
          this.dialogOpen.set(false);
          this.resolve(true);
        },
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          this.acceptProblem.set(problem);
          if (problem.name === 'terms-version-outdated') {
            this.load();
          }
        },
      });
  }

  /** Closes the dialog without accepting. */
  dismiss(): void {
    this.dialogOpen.set(false);
    this.resolve(false);
  }

  /** Marks the acceptance as outdated after the server answered `consent-required`, and reloads the terms. */
  invalidate(): void {
    const acceptance = this.acceptance();
    if (acceptance) {
      this.acceptance.set({ ...acceptance, isCurrent: false });
    }
    this.load();
  }

  private resolve(accepted: boolean): void {
    const decision = this.pendingDecision;
    this.pendingDecision = null;
    decision?.next(accepted);
    decision?.complete();
  }
}
