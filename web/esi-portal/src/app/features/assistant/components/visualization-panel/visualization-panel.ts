import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';

import type { QueryResult, VisualizationIntent } from '../../../../core/api';
import { toSurfaceData } from '../../helpers/dsl-adapter';
import type { SaveState, VisualizationState } from '../../services/chat.service';
import type { LiveData } from '../../services/live-data';
import { DslView } from '../dsl-view/dsl-view';
import { ProblemMessage } from '../problem-message/problem-message';

const KIND_LABELS: Readonly<Record<VisualizationIntent['kind'], string>> = {
  table: 'table',
  kpi: 'KPI',
  chart: 'chart',
};

/**
 * Turns a query result into a table, KPI or chart: the request, the preview rendered with the current page's
 * rows, and saving it as an artifact. A chart draws only the current page; the renderer says so in its caption
 * and offers the same rows as a table (ADR-0009). Charts cannot be saved yet (ESI-119). Forms are refused by
 * the server.
 */
@Component({
  selector: 'app-visualization-panel',
  imports: [RouterLink, ButtonDirective, InputText, ProgressSpinner, DslView, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" [attr.aria-labelledby]="headingId()">
      <h4 [id]="headingId()">Visualize this result</h4>
      <div class="request">
        <label [for]="inputId()" class="visually-hidden"
          >What should the visualization show? (optional)</label
        >
        <input
          pInputText
          [id]="inputId()"
          [value]="description()"
          (input)="onInput($event)"
          maxlength="2000"
          placeholder="Optional: what should it show? For example: revenue per customer"
        />
        <div class="actions">
          <button
            pButton
            type="button"
            size="small"
            [outlined]="true"
            [disabled]="pending()"
            (click)="ask('table')"
          >
            Table
          </button>
          <button
            pButton
            type="button"
            size="small"
            [outlined]="true"
            [disabled]="pending()"
            (click)="ask('kpi')"
          >
            KPI
          </button>
          <button
            pButton
            type="button"
            size="small"
            [outlined]="true"
            [disabled]="pending()"
            (click)="ask('chart')"
          >
            Chart
          </button>
        </div>
        <small class="hint">
          Only column names and types are sent, never rows. A KPI shows a value from the first row,
          so ask for SQL that computes the total (for example SUM) rather than relying on the
          visible page. A chart (bar, line or pie) draws only the current page of up to 20 rows, so
          ask for SQL that groups the data first.
        </small>
      </div>

      @switch (state()?.status) {
        @case ('pending') {
          <div class="progress" role="status">
            <p-progressspinner
              styleClass="spinner"
              strokeWidth="6"
              ariaLabel="Creating visualization"
            />
            <span>Creating the {{ kindLabel() }}…</span>
          </div>
        }
        @case ('failure') {
          @if (problem(); as p) {
            <app-problem-message [problem]="p" lead="No visualization was created." />
          }
        }
        @case ('ready') {
          <div class="preview" aria-label="Visualization preview" role="group">
            <app-dsl-view [renderer]="renderer()" [live]="live()" [retryable]="false" />
          </div>
          <div class="save" aria-live="polite">
            @if (isChart()) {
              <small class="hint">Saving charts as artifacts is not available yet.</small>
            } @else {
              @switch (save()?.status) {
                @case ('saved') {
                  @if (saved(); as artifact) {
                    <span class="ok">Saved as “{{ artifact.name }}”.</span>
                    <a [routerLink]="['artifacts', artifact.id]">Open saved visualization</a>
                  }
                }
                @default {
                  <button
                    pButton
                    type="button"
                    size="small"
                    [loading]="save()?.status === 'saving'"
                    (click)="saveRequested.emit()"
                  >
                    Save as artifact
                  </button>
                  @if (saveProblem(); as p) {
                    <app-problem-message [problem]="p" lead="The visualization was not saved." />
                  }
                }
              }
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.75rem;
      border: 1px dashed var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    h4 {
      margin: 0;
      font-size: 0.9375rem;
    }
    .request {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      input {
        flex: 1 1 16rem;
      }
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .hint {
      flex-basis: 100%;
      color: var(--p-text-muted-color);
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
    .preview {
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .save {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }
    .ok {
      color: var(--p-green-700, #15803d);
    }
  `,
})
export class VisualizationPanel {
  /** Unique per message, for ids. */
  readonly key = input.required<string>();
  readonly result = input.required<QueryResult>();
  readonly state = input<VisualizationState | undefined>(undefined);
  readonly save = input<SaveState | undefined>(undefined);

  readonly visualize = output<VisualizationIntent>();
  readonly saveRequested = output();

  protected readonly description = signal('');
  protected readonly headingId = computed(() => `viz-heading-${this.key()}`);
  protected readonly inputId = computed(() => `viz-input-${this.key()}`);
  protected readonly pending = computed(() => this.state()?.status === 'pending');
  protected readonly kindLabel = computed(() => KIND_LABELS[this.state()?.intent.kind ?? 'table']);
  protected readonly isChart = computed(() => this.state()?.intent.kind === 'chart');
  protected readonly renderer = computed(() => {
    const state = this.state();
    return state?.status === 'ready' ? state.renderer : null;
  });
  protected readonly live = computed<LiveData>(() => {
    const result = this.result();
    return { status: 'ready', result, data: toSurfaceData(result) };
  });
  protected readonly problem = computed(() => {
    const state = this.state();
    return state?.status === 'failure' ? state.problem : null;
  });
  protected readonly saved = computed(() => {
    const save = this.save();
    return save?.status === 'saved' ? save.artifact : null;
  });
  protected readonly saveProblem = computed(() => {
    const save = this.save();
    return save?.status === 'failure' ? save.problem : null;
  });

  protected onInput(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  protected ask(kind: VisualizationIntent['kind']): void {
    const description = this.description().trim();
    this.visualize.emit(description ? { kind, description } : { kind });
  }
}
