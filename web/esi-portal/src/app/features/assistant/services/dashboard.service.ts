import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  finalize,
  switchMap,
  tap,
} from 'rxjs';

import {
  ApiProblem,
  ArtifactSummary,
  Dashboard,
  DashboardItem,
  ItemLayout,
  toApiProblem,
} from '../../../core/api';
import { DashboardsApi } from '../apis/dashboards.api';
import { ArtifactsApi } from '../apis/artifacts.api';
import { RendererArtifact, toRendererArtifact, toSurfaceData } from '../helpers/dsl-adapter';
import {
  applyLayout,
  compact,
  hasOverlaps,
  nextLayout,
  readingOrder,
  sameLayouts,
} from '../helpers/grid-layout';
import { isConsentWithdrawn } from '../helpers/problem-message';
import { ConnectionsService } from './connections.service';
import type { LiveData } from './live-data';

/** One dashboard item as the grid shows it. */
export interface DashboardItemView {
  readonly id: string;
  readonly artifactId: string;
  readonly layout: ItemLayout;
  readonly status: DashboardItem['status'];
  readonly title: string;
  readonly kind: string | null;
  readonly renderer: RendererArtifact | null;
}

export type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** Debounce before a changed layout is saved, so a few quick key presses make one request. */
export const LAYOUT_SAVE_DELAY_MS = 400;

function toView(item: DashboardItem): DashboardItemView {
  const artifact = item.artifact;
  return {
    id: item.id,
    artifactId: item.artifactId,
    layout: item.layout,
    status: item.status,
    title: artifact?.name ?? 'Missing visualization',
    kind: artifact?.kind ?? null,
    renderer: artifact ? toRendererArtifact(artifact.dsl, artifact.sql, artifact.columns) : null,
  };
}

/**
 * One open dashboard: its items, the live data of each item (run independently, so one failure does not
 * affect the others), and its layout, which is saved after every change with every item exactly once.
 */
@Injectable()
export class DashboardService {
  private readonly api = inject(DashboardsApi);
  private readonly artifactsApi = inject(ArtifactsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runs = new Map<string, Subscription>();
  private readonly layoutChanges = new Subject<readonly DashboardItemView[]>();

  readonly dashboard = signal<Dashboard | null>(null);
  readonly items = signal<readonly DashboardItemView[]>([]);
  readonly live = signal<ReadonlyMap<string, LiveData>>(new Map());
  readonly loading = signal(false);
  readonly problem = signal<ApiProblem | null>(null);
  readonly layoutState = signal<LayoutSaveState>('idle');
  readonly layoutProblem = signal<ApiProblem | null>(null);
  readonly actionProblem = signal<ApiProblem | null>(null);
  readonly busy = signal(false);

  constructor() {
    this.layoutChanges
      .pipe(
        debounceTime(LAYOUT_SAVE_DELAY_MS),
        switchMap((items) => this.saveLayout(items)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.destroyRef.onDestroy(() => this.cancelRuns());
  }

  load(dashboardId: string): void {
    this.cancelRuns();
    this.loading.set(true);
    this.problem.set(null);
    this.api
      .get(dashboardId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dashboard) => this.show(dashboard),
        error: (error: unknown) => this.problem.set(this.read(error)),
      });
  }

  /** Runs one item's saved SELECT (page 1). Missing and unavailable items are not run. */
  runItem(itemId: string): void {
    const item = this.items().find((i) => i.id === itemId);
    if (!item || item.status !== 'available' || item.renderer?.status !== 'ready') return;
    this.runs.get(itemId)?.unsubscribe();
    this.setLive(itemId, { status: 'loading' });
    this.runs.set(
      itemId,
      this.artifactsApi.execute(item.artifactId, 1).subscribe({
        next: (result) =>
          this.setLive(itemId, { status: 'ready', result, data: toSurfaceData(result) }),
        error: (error: unknown) =>
          this.setLive(itemId, { status: 'failure', problem: this.read(error) }),
      }),
    );
  }

  /** Moves or resizes one item; other items make room. The new layout is saved shortly after. */
  changeLayout(itemId: string, layout: ItemLayout): void {
    const next = applyLayout(this.items(), itemId, layout);
    if (sameLayouts(next, this.items())) return;
    this.items.set(next);
    this.layoutState.set('saving');
    this.layoutChanges.next(next);
  }

  retryLayout(): void {
    this.layoutState.set('saving');
    this.layoutChanges.next(this.items());
  }

  addItem(artifact: ArtifactSummary): void {
    const dashboard = this.dashboard();
    if (!dashboard) return;
    this.busy.set(true);
    this.actionProblem.set(null);
    this.api
      .addItem(dashboard.id, artifact.id, nextLayout(this.items(), artifact.kind))
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // The added item comes with its artifact; reload the dashboard if a server leaves it out.
        next: (item) =>
          item.artifact || item.status !== 'available'
            ? this.addView(item)
            : this.load(dashboard.id),
        error: (error: unknown) => this.actionProblem.set(this.read(error)),
      });
  }

  removeItem(itemId: string): void {
    const dashboard = this.dashboard();
    if (!dashboard) return;
    this.actionProblem.set(null);
    this.api
      .removeItem(dashboard.id, itemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.runs.get(itemId)?.unsubscribe();
          this.items.update((items) => items.filter((i) => i.id !== itemId));
        },
        error: (error: unknown) => this.actionProblem.set(this.read(error)),
      });
  }

  rename(name: string): Observable<Dashboard> {
    const dashboard = this.dashboard();
    return this.api
      .rename(dashboard?.id ?? '', name)
      .pipe(
        tap((renamed) =>
          this.dashboard.set({ ...renamed, items: dashboard?.items ?? renamed.items }),
        ),
      );
  }

  delete(): Observable<void> {
    return this.api.delete(this.dashboard()?.id ?? '');
  }

  private show(dashboard: Dashboard): void {
    this.dashboard.set(dashboard);
    const stored = readingOrder(dashboard.items.map(toView));
    // A stored layout with overlapping items (for example from an older client) is repaired and saved.
    const items = hasOverlaps(stored) ? compact(stored) : stored;
    this.items.set(items);
    this.live.set(new Map());
    this.layoutState.set('idle');
    if (!sameLayouts(items, stored)) {
      this.layoutState.set('saving');
      this.layoutChanges.next(items);
    }
    for (const item of items) this.runItem(item.id);
  }

  private addView(item: DashboardItem): void {
    const view = toView(item);
    this.items.update((items) => readingOrder([...items, view]));
    this.runItem(view.id);
  }

  private saveLayout(items: readonly DashboardItemView[]): Observable<unknown> {
    const dashboard = this.dashboard();
    if (!dashboard) return EMPTY;
    this.layoutProblem.set(null);
    return this.api
      .saveLayout(
        dashboard.id,
        items.map((item) => ({ itemId: item.id, layout: item.layout })),
      )
      .pipe(
        tap({
          next: () => {
            this.layoutState.set('saved');
          },
          error: (error: unknown) => {
            this.layoutProblem.set(this.read(error));
            this.layoutState.set('failed');
          },
        }),
        // Keep the stream alive after a failed save; the user can retry.
        catchError(() => EMPTY),
      );
  }

  private setLive(itemId: string, state: LiveData): void {
    this.live.update((current) => new Map(current).set(itemId, state));
  }

  private cancelRuns(): void {
    for (const run of this.runs.values()) run.unsubscribe();
    this.runs.clear();
  }

  private read(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    const connectionId = this.dashboard()?.connectionId;
    if (isConsentWithdrawn(problem) && connectionId) this.connections.markWithdrawn(connectionId);
    return problem;
  }
}
