import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map, tap } from 'rxjs';

import { ApiProblem, Connection, ConnectionTestResult, toApiProblem } from '../../../core/api';
import { ConnectionsApi } from '../apis/connections.api';

/** The user's connections (newest first) and the operations on them. Never holds a connection string. */
@Injectable()
export class ConnectionsService {
  private readonly api = inject(ConnectionsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly connections = signal<readonly Connection[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly loadProblem = signal<ApiProblem | null>(null);

  load(): void {
    this.loading.set(true);
    this.loadProblem.set(null);
    this.api
      .list()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connections) => {
          this.connections.set(connections);
          this.loaded.set(true);
        },
        error: (error: unknown) => this.loadProblem.set(toApiProblem(error)),
      });
  }

  find(connectionId: string): Connection | undefined {
    return this.connections().find((connection) => connection.id === connectionId);
  }

  create(name: string, connectionString: string): Observable<Connection> {
    return this.api
      .create(name, connectionString)
      .pipe(tap((created) => this.connections.update((list) => [created, ...list])));
  }

  update(connectionId: string, name: string, connectionString?: string): Observable<Connection> {
    return this.api
      .update(connectionId, name, connectionString)
      .pipe(tap((updated) => this.replace(updated)));
  }

  delete(connectionId: string): Observable<void> {
    return this.api
      .delete(connectionId)
      .pipe(
        tap(() => this.connections.update((list) => list.filter((c) => c.id !== connectionId))),
      );
  }

  test(connectionId: string): Observable<ConnectionTestResult> {
    return this.api.test(connectionId);
  }

  grantConsent(connectionId: string): Observable<Connection> {
    return this.api.grantConsent(connectionId).pipe(tap((updated) => this.replace(updated)));
  }

  /** Withdraws consent; the connection is marked withdrawn locally at once, which closes its features. */
  withdrawConsent(connectionId: string): Observable<void> {
    return this.api.withdrawConsent(connectionId).pipe(
      tap(() => this.markWithdrawn(connectionId)),
      map(() => undefined),
    );
  }

  /** Called when the server answers `consent-withdrawn` for a connection the list still shows as granted. */
  markWithdrawn(connectionId: string): void {
    this.connections.update((list) =>
      list.map((c) => (c.id === connectionId ? { ...c, consent: 'withdrawn' as const } : c)),
    );
  }

  private replace(updated: Connection): void {
    this.connections.update((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  }
}
