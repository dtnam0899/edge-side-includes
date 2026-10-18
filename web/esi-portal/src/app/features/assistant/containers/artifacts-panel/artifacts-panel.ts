import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Skeleton } from 'primeng/skeleton';

import type { ArtifactSummary } from '../../../../core/api';
import { ArtifactList } from '../../components/artifact-list/artifact-list';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { ArtifactsService } from '../../services/artifacts.service';

/** Saved visualizations of the connection, with deletion after confirmation. */
@Component({
  selector: 'app-artifacts-panel',
  imports: [Skeleton, ArtifactList, ProblemMessage],
  providers: [ArtifactsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @if (artifacts.problem(); as problem) {
        <app-problem-message [problem]="problem" />
      }
      @if (artifacts.loading() && !artifacts.loaded()) {
        <div aria-hidden="true"><p-skeleton height="4rem" /></div>
        <span class="visually-hidden" role="status">Loading saved visualizations…</span>
      } @else if (artifacts.loaded()) {
        <app-artifact-list
          [artifacts]="artifacts.artifacts()"
          [deletingId]="artifacts.deletingId()"
          (remove)="confirmDelete($event)"
        />
      }
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
  `,
})
export class ArtifactsPanel {
  readonly connectionId = input.required<string>();

  protected readonly artifacts = inject(ArtifactsService);
  private readonly confirmation = inject(ConfirmationService);

  constructor() {
    effect(() => {
      const connectionId = this.connectionId();
      untracked(() => this.artifacts.load(connectionId));
    });
  }

  protected confirmDelete(artifact: ArtifactSummary): void {
    this.confirmation.confirm({
      header: 'Delete saved visualization?',
      message: `“${artifact.name}” is deleted. Dashboard items that show it will report it as deleted. The database is not changed.`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.artifacts.delete(artifact.id),
    });
  }
}
