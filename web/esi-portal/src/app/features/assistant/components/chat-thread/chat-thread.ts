import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { ProgressSpinner } from 'primeng/progressspinner';

import type { ChatMessage, VisualizationIntent } from '../../../../core/api';
import type {
  ExecutionState,
  FailedQuestion,
  SaveState,
  VisualizationState,
} from '../../services/chat.service';
import { GeneratedSqlView } from '../generated-sql/generated-sql';
import { ProblemMessage } from '../problem-message/problem-message';
import { ExecutionOutcome } from '../execution-outcome/execution-outcome';
import { VisualizationPanel } from '../visualization-panel/visualization-panel';

export interface RunRequest {
  readonly message: ChatMessage;
  readonly page: number;
}

/** The messages of a chat session with in-progress, success and failure states of questions and query runs. */
@Component({
  selector: 'app-chat-thread',
  imports: [
    ButtonDirective,
    ProgressSpinner,
    GeneratedSqlView,
    ProblemMessage,
    ExecutionOutcome,
    VisualizationPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="thread" aria-label="Conversation">
      @for (message of messages(); track message.id) {
        <li [class]="message.role">
          <span class="who">{{ message.role === 'user' ? 'You' : 'Assistant' }}</span>
          <p class="text">{{ message.text }}</p>
          @if (message.generatedSql; as sql) {
            @if (sql.kind !== 'none') {
              @let execution = executions().get(message.id);
              <app-generated-sql
                [sql]="sql"
                [execution]="execution"
                [canRun]="canRun()"
                (run)="run.emit({ message, page: 1 })"
              />
              @if (execution) {
                <app-execution-outcome
                  [execution]="execution"
                  (pageChange)="run.emit({ message, page: $event })"
                />
                @if (execution.status === 'success' && execution.raw.columns.length) {
                  <app-visualization-panel
                    [key]="message.id"
                    [result]="execution.raw"
                    [state]="visualizations().get(message.id)"
                    [save]="saves().get(message.id)"
                    (visualize)="visualize.emit({ message, intent: $event })"
                    (saveRequested)="saveVisualization.emit(message)"
                  />
                }
              }
            }
          }
        </li>
      }
      @if (pendingQuestion(); as question) {
        <li class="user">
          <span class="who">You</span>
          <p class="text">{{ question }}</p>
        </li>
        <li class="assistant">
          <span class="who">Assistant</span>
          <div class="progress">
            <p-progressspinner
              styleClass="spinner"
              strokeWidth="6"
              ariaLabel="Generating an answer"
            />
            <span>Generating SQL for your question… Nothing is run until you choose to.</span>
          </div>
        </li>
      }
      @if (failedQuestion(); as failed) {
        <li class="user failed">
          <span class="who">You</span>
          <p class="text">{{ failed.text }}</p>
          <app-problem-message [problem]="failed.problem" lead="No answer was generated." />
          <div>
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              [outlined]="true"
              (click)="retry.emit(failed.text)"
            >
              Try again
            </button>
          </div>
        </li>
      }
    </ol>
    <p class="visually-hidden" aria-live="polite">{{ liveStatus() }}</p>
  `,
  styles: `
    .thread {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    li {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    li.user {
      align-self: flex-end;
      max-width: min(40rem, 90%);
      padding: 0.625rem 0.875rem;
      border-radius: var(--p-content-border-radius);
      background: var(--p-highlight-background);
      color: var(--p-highlight-color);
    }
    li.user.failed {
      background: transparent;
      color: inherit;
      border: 1px solid var(--p-content-border-color);
    }
    .who {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.8;
    }
    .text {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.5;
    }
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
export class ChatThread {
  readonly messages = input.required<readonly ChatMessage[]>();
  readonly pendingQuestion = input<string | null>(null);
  readonly failedQuestion = input<FailedQuestion | null>(null);
  readonly executions = input<ReadonlyMap<string, ExecutionState>>(new Map());
  readonly visualizations = input<ReadonlyMap<string, VisualizationState>>(new Map());
  readonly saves = input<ReadonlyMap<string, SaveState>>(new Map());
  readonly canRun = input(true);

  readonly run = output<RunRequest>();
  readonly visualize = output<{ message: ChatMessage; intent: VisualizationIntent }>();
  readonly saveVisualization = output<ChatMessage>();
  readonly retry = output<string>();

  /** Short status for screen readers; the visible states are in the list itself. */
  protected readonly liveStatus = computed(() => {
    if (this.pendingQuestion()) return 'Generating an answer.';
    if (this.failedQuestion()) return 'No answer was generated.';
    return '';
  });
}
