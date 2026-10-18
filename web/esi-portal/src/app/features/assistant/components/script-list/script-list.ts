import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import type { Script } from '../../../../core/api';

/** Saved stored-procedure scripts. They are deliverables for the user to run; the assistant never runs them. */
@Component({
  selector: 'app-script-list',
  imports: [DatePipe, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!scripts().length) {
      <p class="empty">
        No saved scripts. When the assistant writes a stored procedure for you, the script is saved
        here automatically.
      </p>
    } @else {
      <ul>
        @for (script of scripts(); track script.id) {
          <li>
            <div class="head">
              <div>
                <h4>{{ script.name }}</h4>
                <small>Saved {{ script.createdAt | date: 'medium' }}</small>
              </div>
              <button
                pButton
                type="button"
                size="small"
                severity="danger"
                [text]="true"
                [attr.aria-label]="'Delete script ' + script.name"
                [loading]="deletingId() === script.id"
                (click)="remove.emit(script)"
              >
                Delete
              </button>
            </div>
            <details>
              <summary>Show script</summary>
              <pre
                tabindex="0"
                [attr.aria-label]="script.name + ' script text'"
              ><code>{{ script.sql }}</code></pre>
            </details>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    li {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 0.75rem;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    h4 {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      overflow-wrap: anywhere;
    }
    small {
      color: var(--p-text-muted-color);
    }
    summary {
      cursor: pointer;
      margin-top: 0.5rem;
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
    .empty {
      margin: 0;
      color: var(--p-text-muted-color);
    }
  `,
})
export class ScriptList {
  readonly scripts = input.required<readonly Script[]>();
  readonly deletingId = input<string | null>(null);

  readonly remove = output<Script>();
}
