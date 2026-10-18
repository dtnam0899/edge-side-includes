import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, tap } from 'rxjs';

import { ApiProblem, Dashboard, DashboardSummary, toApiProblem } from '../../../core/api';
import { DashboardsApi } from '../apis/dashboards.api';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';

/** Dashboards of one connection (the list). Provided by the dashboards panel. */
@Injectable()
export class DashboardsService {
  private readonly api = inject(DashboardsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private connectionId = '';

  readonly dashboards = signal<readonly DashboardSummary[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly problem = signal<ApiProblem | null>(null);

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
        next: (dashboards) => {
          this.dashboards.set(dashboards);
          this.loaded.set(true);
        },
        error: (error: unknown) => this.problem.set(this.read(error)),
      });
  }

  create(name: string): Observable<Dashboard> {
    return this.api.create(this.connectionId, name).pipe(
      tap((dashboard) =>
        this.dashboards.update((list) => [
          {
            id: dashboard.id,
            connectionId: dashboard.connectionId,
            name: dashboard.name,
            itemCount: 0,
            updatedAt: dashboard.updatedAt,
          },
          ...list,
        ]),
      ),
    );
  }

  private read(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    if (isConsentWithdrawn(problem)) this.connections.markWithdrawn(this.connectionId);
    return problem;
  }
}
