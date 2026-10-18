import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { finalize } from 'rxjs';

import { ApiProblem, toApiProblem } from '../../../../core/api';
import { DashboardList } from '../../components/dashboard-list/dashboard-list';
import { NameDialog } from '../../components/name-dialog/name-dialog';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { DashboardsService } from '../../services/dashboards.service';

/** The connection's dashboards and creating a new one. */
@Component({
  selector: 'app-dashboards-panel',
  imports: [ButtonDirective, Skeleton, DashboardList, NameDialog, ProblemMessage],
  providers: [DashboardsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <div>
        <button pButton type="button" size="small" (click)="creating.set(true)">
          New dashboard
        </button>
      </div>
      @if (dashboards.problem(); as problem) {
        <app-problem-message [problem]="problem" lead="Dashboards could not be loaded." />
      } @else if (dashboards.loading() && !dashboards.loaded()) {
        <div aria-hidden="true"><p-skeleton height="4rem" /></div>
        <span class="visually-hidden" role="status">Loading dashboards…</span>
      } @else if (dashboards.loaded()) {
        <app-dashboard-list [dashboards]="dashboards.dashboards()" />
      }
    </div>
    <app-name-dialog
      [visible]="creating()"
      header="New dashboard"
      submitLabel="Create"
      [saving]="saving()"
      [problem]="createProblem()"
      (saved)="create($event)"
      (dismissed)="close()"
    />
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
  `,
})
export class DashboardsPanel {
  readonly connectionId = input.required<string>();

  protected readonly dashboards = inject(DashboardsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly createProblem = signal<ApiProblem | null>(null);

  constructor() {
    effect(() => {
      const connectionId = this.connectionId();
      untracked(() => this.dashboards.load(connectionId));
    });
  }

  protected create(name: string): void {
    this.saving.set(true);
    this.createProblem.set(null);
    this.dashboards
      .create(name)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dashboard) => {
          this.creating.set(false);
          void this.router.navigate(['dashboards', dashboard.id], { relativeTo: this.route });
        },
        error: (error: unknown) => this.createProblem.set(toApiProblem(error)),
      });
  }

  protected close(): void {
    this.creating.set(false);
    this.createProblem.set(null);
  }
}
