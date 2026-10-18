import { DatePipe } from '@angular/common';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import { ApiProblem, toApiProblem } from '../../../../core/api';
import { DslView } from '../../components/dsl-view/dsl-view';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { artifactStatusLabel, artifactStatusMessage } from '../../helpers/artifact-status';
import { ArtifactViewService } from '../../services/artifact-view.service';
import { ConnectionsService } from '../../services/connections.service';

/** One saved visualization rendered with live data, page by page. */
@Component({
  selector: 'app-artifact-page',
  imports: [DatePipe, RouterLink, ButtonDirective, Message, Skeleton, Tag, DslView, ProblemMessage],
  providers: [ArtifactViewService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a
        [routerLink]="['/assistant/connections', connectionId()]"
        [queryParams]="{ tab: 'artifacts' }"
        class="back"
        >← Back to the database</a
      >
      @if (withdrawn()) {
        <p-message severity="warn">
          Consent for this database was withdrawn, so its saved visualizations are hidden. Grant
          consent again on the database page to restore them.
        </p-message>
      } @else if (view.problem(); as problem) {
        <app-problem-message
          [problem]="problem"
          lead="This saved visualization could not be opened."
        />
      } @else if (view.artifact(); as artifact) {
        <header>
          <div>
            <h2>{{ artifact.name }}</h2>
            <p class="meta">
              <p-tag severity="secondary" [value]="artifact.kind === 'kpi' ? 'KPI' : 'Table'" />
              Saved {{ artifact.createdAt | date: 'medium' }}
            </p>
          </div>
          <button pButton type="button" severity="danger" [text]="true" (click)="confirmDelete()">
            Delete
          </button>
        </header>
        @if (deleteProblem(); as problem) {
          <app-problem-message [problem]="problem" />
        }
        @if (artifact.status !== 'available') {
          <p-message severity="warn">
            <strong>{{ statusLabel(artifact.status) }}.</strong>
            {{ statusMessage(artifact.status) }}
          </p-message>
        } @else {
          <section class="surface" aria-label="Live visualization">
            <app-dsl-view
              [renderer]="view.renderer()"
              [live]="view.live()"
              (retry)="view.execute(page())"
            />
          </section>
          @if (pageInfo(); as p) {
            <nav class="paging" aria-label="Pages of live data">
              <button
                pButton
                type="button"
                size="small"
                severity="secondary"
                [outlined]="true"
                [disabled]="p.page <= 1"
                (click)="go(p.page - 1)"
              >
                Previous page
              </button>
              <span>Page {{ p.page }}</span>
              <button
                pButton
                type="button"
                size="small"
                severity="secondary"
                [outlined]="true"
                [disabled]="p.remaining === 0"
                (click)="go(p.page + 1)"
              >
                Next page
              </button>
            </nav>
          }
        }
        <details>
          <summary>Show the saved SELECT</summary>
          <pre tabindex="0" aria-label="Saved SELECT"><code>{{ artifact.sql }}</code></pre>
        </details>
      } @else if (view.loading()) {
        <div aria-hidden="true"><p-skeleton height="12rem" /></div>
        <span class="visually-hidden" role="status">Loading the saved visualization…</span>
      }
    </div>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    h2 {
      margin: 0;
      font-size: 1.375rem;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.375rem 0 0;
      color: var(--p-text-muted-color);
    }
    .surface {
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .paging {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    pre {
      margin: 0.5rem 0 0;
      padding: 0.75rem;
      overflow: auto;
      white-space: pre-wrap;
      font-size: 0.8125rem;
      background: var(--p-content-hover-background);
      border-radius: var(--p-content-border-radius);
    }
  `,
})
export class ArtifactPage {
  readonly connectionId = input.required<string>();
  readonly artifactId = input.required<string>();

  protected readonly view = inject(ArtifactViewService);
  private readonly connections = inject(ConnectionsService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusLabel = artifactStatusLabel;
  protected readonly statusMessage = artifactStatusMessage;
  protected readonly page = signal(1);
  protected readonly deleteProblem = signal<ApiProblem | null>(null);
  protected readonly withdrawn = computed(
    () => this.connections.find(this.connectionId())?.consent === 'withdrawn',
  );
  protected readonly pageInfo = computed(() => {
    const live = this.view.live();
    return live?.status === 'ready' ? live.data.page : null;
  });

  constructor() {
    effect(() => {
      const artifactId = this.artifactId();
      const withdrawn = this.withdrawn();
      untracked(() => {
        this.page.set(1);
        if (!withdrawn) this.view.load(artifactId);
      });
    });
  }

  protected go(page: number): void {
    this.page.set(page);
    this.view.execute(page);
  }

  protected confirmDelete(): void {
    const artifact = this.view.artifact();
    if (!artifact) return;
    this.confirmation.confirm({
      header: 'Delete saved visualization?',
      message: `“${artifact.name}” is deleted. Dashboard items that show it will report it as deleted. The database is not changed.`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.view
          .delete()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => void this.router.navigate(['/assistant/connections', this.connectionId()]),
            error: (error: unknown) => this.deleteProblem.set(toApiProblem(error)),
          }),
    });
  }
}
