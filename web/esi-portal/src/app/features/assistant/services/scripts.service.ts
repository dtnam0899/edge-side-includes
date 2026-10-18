import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ApiProblem, Script, toApiProblem } from '../../../core/api';
import { ScriptsApi } from '../apis/scripts.api';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';

/** Stored-procedure scripts the assistant saved for a connection. They are never created in or run against the database. */
@Injectable()
export class ScriptsService {
  private readonly api = inject(ScriptsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private connectionId = '';

  readonly scripts = signal<readonly Script[]>([]);
  readonly loading = signal(false);
  readonly problem = signal<ApiProblem | null>(null);
  readonly deletingId = signal<string | null>(null);

  load(connectionId: string): void {
    this.connectionId = connectionId;
    this.loading.set(true);
    this.problem.set(null);
    this.api
      .list(connectionId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (scripts) => this.scripts.set(scripts),
        error: (error: unknown) => this.problem.set(this.handleProblem(error)),
      });
  }

  delete(scriptId: string): void {
    this.deletingId.set(scriptId);
    this.problem.set(null);
    this.api
      .delete(scriptId)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.scripts.update((list) => list.filter((script) => script.id !== scriptId)),
        error: (error: unknown) => this.problem.set(this.handleProblem(error)),
      });
  }

  private handleProblem(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    if (isConsentWithdrawn(problem)) {
      this.connections.markWithdrawn(this.connectionId);
    }
    return problem;
  }
}
