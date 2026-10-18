import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize } from 'rxjs';

import { ApiProblem, Artifact, toApiProblem } from '../../../core/api';
import { ArtifactsApi } from '../apis/artifacts.api';
import { toRendererArtifact, toSurfaceData } from '../helpers/dsl-adapter';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';
import type { LiveData } from './live-data';

/** One saved artifact with a page of live data. Provided by the artifact page. */
@Injectable()
export class ArtifactViewService {
  private readonly api = inject(ArtifactsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private run: Subscription | null = null;

  readonly artifact = signal<Artifact | null>(null);
  readonly loading = signal(false);
  readonly problem = signal<ApiProblem | null>(null);
  readonly live = signal<LiveData | null>(null);

  readonly renderer = computed(() => {
    const artifact = this.artifact();
    return artifact ? toRendererArtifact(artifact.dsl, artifact.sql, artifact.columns) : null;
  });

  load(artifactId: string): void {
    this.run?.unsubscribe();
    this.artifact.set(null);
    this.live.set(null);
    this.loading.set(true);
    this.problem.set(null);
    this.api
      .get(artifactId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (artifact) => {
          this.artifact.set(artifact);
          if (artifact.status === 'available') this.execute(1);
        },
        error: (error: unknown) => this.problem.set(this.read(error)),
      });
  }

  /** Runs the saved SELECT for one page; only for an available artifact. */
  execute(page: number): void {
    const artifact = this.artifact();
    if (!artifact || artifact.status !== 'available') return;
    this.run?.unsubscribe();
    this.live.set({ status: 'loading' });
    this.run = this.api.execute(artifact.id, page).subscribe({
      next: (result) => this.live.set({ status: 'ready', result, data: toSurfaceData(result) }),
      error: (error: unknown) => this.live.set({ status: 'failure', problem: this.read(error) }),
    });
  }

  delete(): Observable<void> {
    const artifact = this.artifact();
    return this.api.delete(artifact?.id ?? '');
  }

  private read(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    const connectionId = this.artifact()?.connectionId;
    if (isConsentWithdrawn(problem) && connectionId) this.connections.markWithdrawn(connectionId);
    return problem;
  }
}
