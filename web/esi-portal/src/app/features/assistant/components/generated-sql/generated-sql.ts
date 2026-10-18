import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';

import type { GeneratedSql } from '../../../../core/api';
import type { ExecutionState } from '../../services/chat.service';

interface RunStatus {
  readonly label: string;
  readonly severity: 'secondary' | 'info' | 'success' | 'danger';
}

/**
 * SQL proposed by the assistant, as copyable text. It is labelled "Not run" until an execution actually
 * succeeded; running a query is a separate, explicit action. Stored-procedure scripts are never run.
 */
@Component({
  selector: 'app-generated-sql',
  imports: [ButtonDirective, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sql" [attr.aria-label]="heading()">
      <header>
        <span class="heading">{{ heading() }}</span>
        <p-tag [severity]="status().severity" [value]="status().label" />
      </header>
      @if (sql().referencedTables.length) {
        <p class="tables">Uses {{ sql().referencedTables.join(', ') }}</p>
      }
      <pre tabindex="0" [attr.aria-label]="heading() + ' text'"><code>{{ sql().sql }}</code></pre>
      @if (sql().kind === 'stored-procedure') {
        <p class="note">
          Saved to your script library. The assistant never creates or runs stored procedures;
          review the script and run it yourself if you want it.
        </p>
      }
      <div class="actions">
        <button
          pButton
          type="button"
          severity="secondary"
          [outlined]="true"
          size="small"
          (click)="copy()"
        >
          Copy SQL
        </button>
        @if (sql().kind === 'query') {
          <button
            pButton
            type="button"
            size="small"
            [loading]="execution()?.status === 'running'"
            [disabled]="!canRun()"
            (click)="run.emit()"
          >
            {{ hasRun() ? 'Run again' : 'Run query' }}
          </button>
        }
        <span class="copy-status" aria-live="polite">{{ copyStatus() }}</span>
      </div>
    </section>
  `,
  styles: `
    .sql {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: var(--p-content-background);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .heading {
      font-weight: 600;
    }
    .tables,
    .note {
      margin: 0;
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    pre {
      margin: 0;
      padding: 0.75rem;
      overflow: auto;
      max-height: 18rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 0.8125rem;
      line-height: 1.5;
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-hover-background);
      color: var(--p-text-color);
    }
    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .copy-status {
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class GeneratedSqlView {
  readonly sql = input.required<GeneratedSql>();
  readonly execution = input<ExecutionState | undefined>(undefined);
  /** False while the connection cannot run SQL. */
  readonly canRun = input(true);

  readonly run = output();

  protected readonly copyStatus = signal('');

  protected readonly heading = computed(() =>
    this.sql().kind === 'stored-procedure' ? 'Stored-procedure script' : 'Generated SELECT',
  );

  /** True only after an execution succeeded. */
  protected readonly hasRun = computed(() => {
    const execution = this.execution();
    return (
      execution?.status === 'success' ||
      (execution?.status === 'running' && execution.result !== undefined)
    );
  });

  protected readonly status = computed<RunStatus>(() => {
    if (this.sql().kind === 'stored-procedure') {
      return { label: 'Script only, never run', severity: 'info' };
    }
    const execution = this.execution();
    switch (execution?.status) {
      case 'running':
        return { label: 'Running…', severity: 'info' };
      case 'success':
        return { label: `Ran, page ${execution.result.pageNumber}`, severity: 'success' };
      case 'failure':
        return { label: 'Run failed', severity: 'danger' };
      default:
        return { label: 'Not run', severity: 'secondary' };
    }
  });

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.sql().sql);
      this.copyStatus.set('SQL copied to the clipboard.');
    } catch {
      this.copyStatus.set('Copying failed; select the text and copy it manually.');
    }
  }
}
