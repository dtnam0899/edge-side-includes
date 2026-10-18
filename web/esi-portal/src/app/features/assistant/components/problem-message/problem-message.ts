import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Message } from 'primeng/message';

import type { ApiProblem } from '../../../../core/api';
import { problemMessage } from '../../helpers/problem-message';

/** Shows a failed API call: a user-facing explanation, validation findings and the trace id. */
@Component({
  selector: 'app-problem-message',
  imports: [Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-message [severity]="severity()" styleClass="problem">
      <div class="body">
        @if (lead()) {
          <strong>{{ lead() }}</strong>
        }
        <span>{{ text() }}</span>
        @if (problem().issues.length) {
          <ul class="issues">
            @for (issue of problem().issues; track $index) {
              <li>
                <code>{{ issue.code }}</code> {{ issue.message }}
              </li>
            }
          </ul>
        }
        @if (problem().traceId) {
          <small class="trace">Reference: {{ problem().traceId }}</small>
        }
      </div>
    </p-message>
  `,
  styles: `
    .body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .issues {
      margin: 0.25rem 0 0;
      padding-left: 1.25rem;
    }
    .trace {
      opacity: 0.8;
    }
  `,
})
export class ProblemMessage {
  readonly problem = input.required<ApiProblem>();
  /** Optional sentence shown before the explanation, e.g. "The query did not produce a result." */
  readonly lead = input<string>('');
  readonly severity = input<'error' | 'warn'>('error');

  protected readonly text = computed(() => problemMessage(this.problem()));
}
