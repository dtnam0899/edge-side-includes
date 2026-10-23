import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../../core/api';
import { SchemaApi } from '../apis/schema.api';
import { ErdModel, toErdModel } from '../helpers/erd-layout';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';

/** The structure of a connection's database for the schema diagram. Read when the schema tab opens. */
@Injectable()
export class SchemaService {
  private readonly api = inject(SchemaApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly model = signal<ErdModel | null>(null);
  readonly loading = signal(false);
  readonly problem = signal<ApiProblem | null>(null);

  load(connectionId: string): void {
    this.loading.set(true);
    this.problem.set(null);
    this.model.set(null);
    this.api
      .get(connectionId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (metadata) => this.model.set(toErdModel(metadata)),
        error: (error: unknown) => {
          const problem = toApiProblem(error);
          if (isConsentWithdrawn(problem)) {
            this.connections.markWithdrawn(connectionId);
          }
          this.problem.set(problem);
        },
      });
  }
}
