import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { TableModule } from 'primeng/table';

import type { ResultPage } from '../../helpers/query-page';

/**
 * One page (at most 20 rows) of a query result with the remaining-row count and paging. NULLs and cells cut at
 * 64 KB are marked in text, not only by color.
 */
@Component({
  selector: 'app-query-result',
  imports: [DecimalPipe, Paginator, TableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="result" aria-label="Query result" [attr.aria-busy]="loading()">
      <p class="summary" aria-live="polite">
        @if (result().rows.length) {
          Rows {{ result().firstRow | number }}–{{ result().lastRow | number }}.
          @if (result().remainingRows > 0) {
            {{ result().remainingRows | number }} more
            {{ result().remainingRows === 1 ? 'row' : 'rows' }} after this page.
          } @else {
            No more rows.
          }
        } @else {
          The query ran and returned no rows on this page.
        }
        <span class="muted">({{ result().durationMs | number }} ms)</span>
      </p>
      @if (result().truncatedCount) {
        <p class="muted">
          {{ result().truncatedCount }}
          {{ result().truncatedCount === 1 ? 'cell was' : 'cells were' }} cut at 64 KB and marked
          “truncated”.
        </p>
      }
      <p-table
        [value]="$any(result().rows)"
        [columns]="$any(result().columns)"
        [scrollable]="true"
        size="small"
        [tableStyle]="{ 'min-width': 'max-content' }"
        styleClass="table"
      >
        <ng-template #header let-columns>
          <tr>
            @for (column of columns; track column.name) {
              <th scope="col">
                <span class="col-name">{{ column.name }}</span>
                <span class="col-type">{{ column.sqlType }}</span>
              </th>
            }
          </tr>
        </ng-template>
        <ng-template #body let-row let-columns="columns">
          <tr>
            @for (column of columns; track column.name) {
              <td>
                @let cell = row.cells[column.name];
                @if (cell.isNull) {
                  <span class="null">NULL</span>
                } @else {
                  <span class="value">{{ cell.text }}</span>
                }
                @if (cell.truncated) {
                  <span class="truncated">truncated</span>
                }
              </td>
            }
          </tr>
        </ng-template>
      </p-table>
      @if (result().knownTotalRows > result().pageSize) {
        <p-paginator
          [rows]="result().pageSize"
          [first]="(result().pageNumber - 1) * result().pageSize"
          [totalRecords]="result().knownTotalRows"
          [pageLinkSize]="5"
          (onPageChange)="onPage($event)"
        />
      }
    </section>
  `,
  styles: `
    .result {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .result[aria-busy='true'] {
      opacity: 0.6;
    }
    .summary,
    .muted {
      margin: 0;
      font-size: 0.875rem;
    }
    .muted {
      color: var(--p-text-muted-color);
    }
    :host ::ng-deep .table {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    th {
      vertical-align: bottom;
    }
    .col-name {
      display: block;
    }
    .col-type {
      display: block;
      font-weight: 400;
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    td {
      max-width: 24rem;
      overflow-wrap: anywhere;
      vertical-align: top;
    }
    .value {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 6;
      line-clamp: 6;
      overflow: hidden;
    }
    .null {
      font-style: italic;
      color: var(--p-text-muted-color);
    }
    .truncated {
      margin-left: 0.375rem;
      padding: 0 0.25rem;
      font-size: 0.75rem;
      border: 1px dashed currentColor;
      border-radius: 0.25rem;
      color: var(--p-orange-700, #c2410c);
    }
  `,
})
export class QueryResultView {
  readonly result = input.required<ResultPage>();
  /** Another page is being fetched; the current page stays visible meanwhile. */
  readonly loading = input(false);

  /** Requested 1-based page number. */
  readonly pageChange = output<number>();

  protected onPage(state: PaginatorState): void {
    const page = (state.page ?? 0) + 1;
    if (page !== this.result().pageNumber) {
      this.pageChange.emit(page);
    }
  }
}
