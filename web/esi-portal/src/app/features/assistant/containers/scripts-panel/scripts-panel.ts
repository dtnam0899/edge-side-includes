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

import type { Script } from '../../../../core/api';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { ScriptList } from '../../components/script-list/script-list';
import { ScriptsService } from '../../services/scripts.service';

/** The connection's saved stored-procedure scripts, with deletion after confirmation. */
@Component({
  selector: 'app-scripts-panel',
  imports: [Skeleton, ProblemMessage, ScriptList],
  providers: [ScriptsService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      @if (scripts.problem(); as problem) {
        <app-problem-message [problem]="problem" />
      }
      @if (scripts.loading() && !scripts.scripts().length) {
        <div aria-hidden="true"><p-skeleton height="4rem" /></div>
        <span class="visually-hidden" role="status">Loading scripts…</span>
      } @else if (!scripts.problem() || scripts.scripts().length) {
        <app-script-list
          [scripts]="scripts.scripts()"
          [deletingId]="scripts.deletingId()"
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
export class ScriptsPanel {
  readonly connectionId = input.required<string>();

  protected readonly scripts = inject(ScriptsService);
  private readonly confirmation = inject(ConfirmationService);

  constructor() {
    effect(() => {
      const connectionId = this.connectionId();
      untracked(() => this.scripts.load(connectionId));
    });
  }

  protected confirmDelete(script: Script): void {
    this.confirmation.confirm({
      header: 'Delete script?',
      message: `“${script.name}” is removed from your library. This cannot be undone. The database is not changed.`,
      acceptLabel: 'Delete script',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.scripts.delete(script.id),
    });
  }
}
