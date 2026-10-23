import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { finalize, map } from 'rxjs';

import { ApiProblem, ArtifactSummary, toApiProblem } from '../../../../core/api';
import {
  DashboardGrid,
  GAP_PX,
  LayoutChange,
  ROW_HEIGHT_PX,
} from '../../components/dashboard-grid/dashboard-grid';
import { DslView } from '../../components/dsl-view/dsl-view';
import { NameDialog } from '../../components/name-dialog/name-dialog';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { artifactKindLabel } from '../../helpers/artifact-kind';
import { artifactStatusLabel, artifactStatusMessage } from '../../helpers/artifact-status';
import { ArtifactsService } from '../../services/artifacts.service';
import { ConnectionsService } from '../../services/connections.service';
import { DashboardService } from '../../services/dashboard.service';

/**
 * A personal dashboard: saved visualizations with live data, each in its own surface and wrapper, moved and
 * resized on a grid. Every item loads on its own; the layout is saved after each change.
 */
/** Tile header, body padding and the chart's title, caption and toggle, around the canvas. */
const CHART_CHROME = '10rem';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    ButtonDirective,
    Dialog,
    Message,
    Skeleton,
    Tag,
    DashboardGrid,
    DslView,
    NameDialog,
    ProblemMessage,
  ],
  providers: [DashboardService, ArtifactsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  readonly connectionId = input.required<string>();
  readonly dashboardId = input.required<string>();

  protected readonly board = inject(DashboardService);
  protected readonly artifacts = inject(ArtifactsService);
  private readonly connections = inject(ConnectionsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = artifactStatusLabel;
  protected readonly kindLabel = artifactKindLabel;
  protected readonly statusMessage = artifactStatusMessage;

  /**
   * Canvas height for a chart in a tile of `rows` grid rows, so its title, its "First 20 of N rows" caption
   * and its "View as table" toggle (ADR-0009) stay visible without scrolling. The renderer reads
   * `--esi-chart-height`; other visualizations ignore it.
   */
  protected chartHeight(rows: number): string {
    const tile = rows * ROW_HEIGHT_PX + (rows - 1) * GAP_PX;
    return `max(6rem, calc(${tile}px - ${CHART_CHROME}))`;
  }
  protected readonly withdrawn = computed(
    () => this.connections.find(this.connectionId())?.consent === 'withdrawn',
  );
  /** Narrow screens stack the items in reading order and do not offer moving or resizing. */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 52rem)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly renaming = signal(false);
  protected readonly renameSaving = signal(false);
  protected readonly renameProblem = signal<ApiProblem | null>(null);
  protected readonly picking = signal(false);
  protected readonly deleteProblem = signal<ApiProblem | null>(null);

  /** Saved visualizations that can be added (available ones; the same one may be added more than once). */
  protected readonly addable = computed(() =>
    this.artifacts.artifacts().filter((a) => a.status === 'available'),
  );

  constructor() {
    effect(() => {
      const dashboardId = this.dashboardId();
      const connectionId = this.connectionId();
      const withdrawn = this.withdrawn();
      untracked(() => {
        if (withdrawn) return;
        this.board.load(dashboardId);
        this.artifacts.load(connectionId);
      });
    });
  }

  protected onLayoutChange(change: LayoutChange): void {
    this.board.changeLayout(change.itemId, change.layout);
  }

  protected add(artifact: ArtifactSummary): void {
    this.picking.set(false);
    this.board.addItem(artifact);
  }

  protected rename(name: string): void {
    this.renameSaving.set(true);
    this.renameProblem.set(null);
    this.board
      .rename(name)
      .pipe(
        finalize(() => this.renameSaving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.renaming.set(false),
        error: (error: unknown) => this.renameProblem.set(toApiProblem(error)),
      });
  }

  protected closeRename(): void {
    this.renaming.set(false);
    this.renameProblem.set(null);
  }

  protected confirmDelete(): void {
    const dashboard = this.board.dashboard();
    if (!dashboard) return;
    this.confirmation.confirm({
      header: 'Delete dashboard?',
      message: `“${dashboard.name}” is deleted. Its saved visualizations stay.`,
      acceptLabel: 'Delete dashboard',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.board
          .delete()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => void this.router.navigate(['/assistant/connections', this.connectionId()]),
            error: (error: unknown) => this.deleteProblem.set(toApiProblem(error)),
          }),
    });
  }
}
