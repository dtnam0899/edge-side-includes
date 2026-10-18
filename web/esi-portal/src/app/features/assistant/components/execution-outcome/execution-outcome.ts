import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ProgressSpinner } from 'primeng/progressspinner';

import type { ExecutionState } from '../../services/chat.service';
import { ProblemMessage } from '../problem-message/problem-message';
import { QueryResultView } from '../query-result/query-result';

/** What running a query produced: progress, the result page, or the failure (never an empty result). */
@Component({
  selector: 'app-execution-outcome',
  imports: [ProgressSpinner, ProblemMessage, QueryResultView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (problem(); as p) {
      <app-problem-message [problem]="p" lead="The query did not produce a result." />
    } @else if (result(); as r) {
      <app-query-result [result]="r" [loading]="running()" (pageChange)="pageChange.emit($event)" />
    } @else if (running()) {
      <div class="progress" role="status">
        <p-progressspinner styleClass="spinner" strokeWidth="6" ariaLabel="Running query" />
        <span>Running the query…</span>
      </div>
    }
  `,
  styles: `
    .progress {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--p-text-muted-color);
    }
    :host ::ng-deep .spinner {
      width: 1.5rem;
      height: 1.5rem;
      margin: 0;
    }
  `,
})
export class ExecutionOutcome {
  readonly execution = input.required<ExecutionState>();

  readonly pageChange = output<number>();

  protected readonly running = computed(() => this.execution().status === 'running');
  protected readonly result = computed(() => {
    const execution = this.execution();
    return execution.status === 'failure' ? undefined : execution.result;
  });
  protected readonly problem = computed(() => {
    const execution = this.execution();
    return execution.status === 'failure' ? execution.problem : null;
  });
}
