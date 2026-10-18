import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DslSurface } from '@dtnam0899/dsl-renderer-angular';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Skeleton } from 'primeng/skeleton';

import type { RendererArtifact } from '../../helpers/dsl-adapter';
import type { LiveData } from '../../services/live-data';
import { ProblemMessage } from '../problem-message/problem-message';

/**
 * A DSL document rendered with live rows through `<esi-dsl-surface>`. The renderer validates the document and
 * shows its own error state for invalid DSL or a missing bound column; failures to get data are shown here.
 * Nothing is ever shown as empty data when something failed.
 */
@Component({
  selector: 'app-dsl-view',
  imports: [DecimalPipe, DslSurface, ButtonDirective, Message, Skeleton, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (renderer(); as r) {
      @if (r.status === 'migration-required') {
        <p-message severity="warn">
          This visualization was saved with DSL version {{ r.dslSchemaVersion }}, which this portal
          cannot render yet.
        </p-message>
      } @else {
        @switch (live()?.status) {
          @case ('ready') {
            @if (data(); as d) {
              <div class="surface">
                <esi-dsl-surface [artifact]="r.artifact" [data]="d" />
              </div>
              @if (showPaging() && !missingColumns()) {
                <p class="live-caption">
                  Live data, rows {{ firstRow() | number }}–{{ lastRow() | number }} of
                  {{ d.page.totalRows | number }}.
                </p>
              }
            }
          }
          @case ('failure') {
            @if (problem(); as p) {
              <app-problem-message [problem]="p" lead="The live data could not be loaded." />
              @if (retryable()) {
                <button
                  pButton
                  type="button"
                  size="small"
                  severity="secondary"
                  [outlined]="true"
                  (click)="retry.emit()"
                >
                  Try again
                </button>
              }
            }
          }
          @default {
            <div aria-hidden="true"><p-skeleton height="6rem" /></div>
            <span class="visually-hidden" role="status">Loading live data…</span>
          }
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .surface {
      overflow: auto;
    }
    .live-caption {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }
  `,
})
export class DslView {
  readonly renderer = input<RendererArtifact | null>(null);
  readonly live = input<LiveData | null>(null);
  /** Show the "rows a–b of n" caption under the surface. */
  readonly showPaging = input(true);
  readonly retryable = input(true);

  readonly retry = output();

  protected readonly data = computed(() => {
    const live = this.live();
    return live?.status === 'ready' ? live.data : null;
  });
  protected readonly problem = computed(() => {
    const live = this.live();
    return live?.status === 'failure' ? live.problem : null;
  });
  /** Declared columns the live result does not have; the renderer then shows its error state. */
  protected readonly missingColumns = computed(() => {
    const renderer = this.renderer();
    const data = this.data();
    if (renderer?.status !== 'ready' || !data) return false;
    const live = new Set(data.columns.map((c) => (typeof c === 'string' ? c : c.name)));
    return renderer.artifact.columns.some((column) => !live.has(column.name));
  });
  protected readonly firstRow = computed(() => {
    const page = this.data()?.page;
    return page && this.data()!.rows.length ? (page.page - 1) * page.pageSize + 1 : 0;
  });
  protected readonly lastRow = computed(() => {
    const data = this.data();
    return data ? (data.page.page - 1) * data.page.pageSize + data.rows.length : 0;
  });
}
