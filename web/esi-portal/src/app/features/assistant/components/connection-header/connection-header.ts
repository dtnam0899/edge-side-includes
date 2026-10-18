import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';

import type { ApiProblem, Connection, ConnectionTestResult } from '../../../../core/api';
import { ProblemMessage } from '../problem-message/problem-message';

export type ConnectionTestState =
  | { readonly status: 'idle' }
  | { readonly status: 'testing' }
  | { readonly status: 'success'; readonly result: ConnectionTestResult }
  | { readonly status: 'failure'; readonly problem: ApiProblem };

/** Name, location and consent of a connection with its actions. Shows no credentials. */
@Component({
  selector: 'app-connection-header',
  imports: [ButtonDirective, Tag, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div class="title">
        <h2>{{ connection().name }}</h2>
        <p class="where">
          SQL Server <span class="mono">{{ connection().server }}</span
          >, database
          <span class="mono">{{ connection().database }}</span>
        </p>
      </div>
      @if (connection().consent === 'granted') {
        <p-tag severity="success" value="Consent granted" />
      } @else {
        <p-tag severity="warn" value="Consent withdrawn" />
      }
    </div>
    <div class="actions">
      @if (connection().consent === 'granted') {
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          [loading]="testState().status === 'testing'"
          (click)="test.emit()"
        >
          Test connection
        </button>
      }
      <button pButton type="button" severity="secondary" [outlined]="true" (click)="edit.emit()">
        Edit
      </button>
      @if (connection().consent === 'granted') {
        <button
          pButton
          type="button"
          severity="warn"
          [outlined]="true"
          [loading]="busy()"
          (click)="withdraw.emit()"
        >
          Withdraw consent
        </button>
      } @else {
        <button pButton type="button" [loading]="busy()" (click)="grant.emit()">
          Grant consent
        </button>
      }
      <button pButton type="button" severity="danger" [text]="true" (click)="remove.emit()">
        Delete
      </button>
    </div>
    <div aria-live="polite" class="test-result">
      @if (testResult(); as result) {
        <p class="ok">
          Connected to SQL Server {{ result.serverVersion }} in {{ result.durationMs }} ms.
        </p>
      }
      @if (testProblem(); as problem) {
        <app-problem-message [problem]="problem" />
      }
    </div>
    @if (actionProblem(); as p) {
      <app-problem-message [problem]="p" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    h2 {
      margin: 0;
      font-size: 1.375rem;
    }
    .where {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
      overflow-wrap: anywhere;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .test-result:empty {
      display: none;
    }
    .ok {
      margin: 0;
      color: var(--p-green-700, #15803d);
    }
  `,
})
export class ConnectionHeader {
  readonly connection = input.required<Connection>();
  readonly testState = input<ConnectionTestState>({ status: 'idle' });
  /** A consent change is in progress. */
  readonly busy = input(false);
  readonly actionProblem = input<ApiProblem | null>(null);

  readonly test = output();
  readonly edit = output();
  readonly withdraw = output();
  readonly grant = output();
  readonly remove = output();

  protected readonly testResult = computed(() => {
    const state = this.testState();
    return state.status === 'success' ? state.result : null;
  });
  protected readonly testProblem = computed(() => {
    const state = this.testState();
    return state.status === 'failure' ? state.problem : null;
  });
}
