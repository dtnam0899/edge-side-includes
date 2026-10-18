import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, filter, finalize } from 'rxjs';

import { ApiProblem, Connection, toApiProblem } from '../../../core/api';
import type { ConnectionFormValue } from '../components/connection-form-dialog/connection-form-dialog';
import { needsTermsAcceptance } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';
import { ConsentService } from './consent.service';

/**
 * Add/edit flow for connections. Adding always passes the consent step first. The dialog is rendered once by the
 * assistant page; any assistant screen opens it through this service.
 */
@Injectable()
export class ConnectionEditorService {
  private readonly connections = inject(ConnectionsService);
  private readonly consent = inject(ConsentService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  /** The connection being edited; `null` while adding. */
  readonly editing = signal<Connection | null>(null);
  readonly saving = signal(false);
  readonly problem = signal<ApiProblem | null>(null);

  /** Opens the add dialog once the current consent terms are accepted. */
  openCreate(): void {
    this.consent
      .ensureAccepted()
      .pipe(
        filter((accepted) => accepted),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.show(null));
  }

  openEdit(connection: Connection): void {
    this.show(connection);
  }

  close(): void {
    this.open.set(false);
    this.problem.set(null);
  }

  save(value: ConnectionFormValue): void {
    const editing = this.editing();
    const request: Observable<Connection> = editing
      ? this.connections.update(editing.id, value.name, value.connectionString)
      : this.connections.create(value.name, value.connectionString ?? '');
    this.saving.set(true);
    this.problem.set(null);
    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (connection) => {
          this.close();
          if (!editing) {
            void this.router.navigate(['/assistant/connections', connection.id]);
          }
        },
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          this.problem.set(problem);
          if (needsTermsAcceptance(problem)) {
            this.consent.invalidate();
          }
        },
      });
  }

  private show(connection: Connection | null): void {
    this.editing.set(connection);
    this.problem.set(null);
    this.open.set(true);
  }
}
