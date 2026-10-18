import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, tap } from 'rxjs';

import {
  ApiProblem,
  Artifact,
  ArtifactSummary,
  CreateArtifactRequest,
  toApiProblem,
} from '../../../core/api';
import { ArtifactsApi } from '../apis/artifacts.api';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';

/** Saved artifacts of one connection. Provided by the containers that list them. */
@Injectable()
export class ArtifactsService {
  private readonly api = inject(ArtifactsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private connectionId = '';

  readonly artifacts = signal<readonly ArtifactSummary[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
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
        next: (artifacts) => {
          this.artifacts.set(artifacts);
          this.loaded.set(true);
        },
        error: (error: unknown) => this.problem.set(this.read(error)),
      });
  }

  create(connectionId: string, request: CreateArtifactRequest): Observable<Artifact> {
    return this.api
      .create(connectionId, request)
      .pipe(tap((artifact) => this.artifacts.update((list) => [artifact, ...list])));
  }

  delete(artifactId: string): void {
    this.deletingId.set(artifactId);
    this.problem.set(null);
    this.api
      .delete(artifactId)
      .pipe(
        finalize(() => this.deletingId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.artifacts.update((list) => list.filter((a) => a.id !== artifactId)),
        error: (error: unknown) => this.problem.set(this.read(error)),
      });
  }

  private read(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    if (isConsentWithdrawn(problem)) this.connections.markWithdrawn(this.connectionId);
    return problem;
  }
}
