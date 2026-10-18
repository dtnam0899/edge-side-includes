import { CdkDrag, CdkDragEnd, CdkDragHandle } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import type { ItemLayout } from '../../../../core/api';
import { GRID_COLUMNS, clampLayout } from '../../helpers/grid-layout';
import type { DashboardItemView } from '../../services/dashboard.service';

/** Height of one grid row and the gap between cells, in pixels (keep in sync with the styles). */
export const ROW_HEIGHT_PX = 64;
export const GAP_PX = 12;

export interface LayoutChange {
  readonly itemId: string;
  readonly layout: ItemLayout;
}

interface ResizeDraft {
  readonly id: string;
  readonly startX: number;
  readonly startY: number;
  readonly start: ItemLayout;
  readonly layout: ItemLayout;
}

/**
 * Grid of dashboard items, each in its own wrapper that can be moved (drag the handle) and resized (drag the
 * corner) with the Angular CDK, or with the keyboard on the focused handle: arrow keys move, Shift + arrow
 * keys resize. It only reports layout changes; the dashboard service applies and saves them.
 */
@Component({
  selector: 'app-dashboard-grid',
  imports: [CdkDrag, CdkDragHandle, NgTemplateOutlet, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p id="dashboard-grid-help" class="visually-hidden">
      Drag an item by its handle to move it, or drag its lower right corner to resize it. With the
      keyboard, focus the handle and use the arrow keys to move, or Shift and the arrow keys to
      resize.
    </p>
    <div
      class="grid"
      #grid
      [class.editable]="editable()"
      [style.grid-template-rows]="rowTemplate()"
    >
      @for (item of items(); track item.id) {
        @let layout = displayed(item);
        <article
          class="item"
          cdkDrag
          [cdkDragDisabled]="!editable()"
          cdkDragBoundary=".grid"
          (cdkDragEnded)="onDragEnded($event, item)"
          [style.grid-column]="layout.x + 1 + ' / span ' + layout.width"
          [style.grid-row]="layout.y + 1 + ' / span ' + layout.height"
          [attr.aria-labelledby]="'dashboard-item-' + item.id"
        >
          <header>
            @if (editable()) {
              <button
                type="button"
                class="handle"
                cdkDragHandle
                [attr.aria-label]="'Move or resize ' + item.title"
                aria-describedby="dashboard-grid-help"
                (keydown)="onKeydown($event, item)"
              >
                <span aria-hidden="true">⠿</span>
              </button>
            }
            <h3 [id]="'dashboard-item-' + item.id">{{ item.title }}</h3>
            <button
              pButton
              type="button"
              size="small"
              severity="secondary"
              [text]="true"
              [attr.aria-label]="'Remove ' + item.title + ' from the dashboard'"
              (click)="remove.emit(item.id)"
            >
              Remove
            </button>
          </header>
          <div class="body">
            <ng-container *ngTemplateOutlet="itemTemplate(); context: { $implicit: item }" />
          </div>
          @if (editable()) {
            <div class="resize" aria-hidden="true" (pointerdown)="startResize($event, item)"></div>
          }
        </article>
      }
    </div>
    <p class="visually-hidden" aria-live="polite">{{ announcement() }}</p>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: 64px;
      gap: 12px;
      position: relative;
    }
    .item {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
      position: relative;
      overflow: hidden;
    }
    .item.cdk-drag-dragging {
      z-index: 2;
      box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
    }
    header {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.25rem 0.25rem 0.5rem;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    h3 {
      flex: 1;
      margin: 0;
      font-size: 0.9375rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .handle {
      cursor: grab;
      border: 1px solid transparent;
      border-radius: var(--p-content-border-radius);
      background: none;
      color: var(--p-text-muted-color);
      font-size: 1.125rem;
      line-height: 1;
      padding: 0.25rem 0.375rem;
      &:hover {
        background: var(--p-content-hover-background);
      }
      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
        outline-offset: 1px;
      }
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: 0.5rem 0.75rem;
    }
    .resize {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 1rem;
      height: 1rem;
      cursor: nwse-resize;
      touch-action: none;
      background: linear-gradient(135deg, transparent 50%, var(--p-text-muted-color) 50%);
      opacity: 0.6;
    }
    @media (max-width: 52rem) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: none !important;
        grid-auto-rows: auto;
      }
      .item {
        grid-column: 1 / -1 !important;
        grid-row: auto !important;
        min-height: 12rem;
      }
    }
  `,
})
export class DashboardGrid {
  /** Items in reading order. */
  readonly items = input.required<readonly DashboardItemView[]>();
  /** Renders the content of one item. */
  readonly itemTemplate = input.required<TemplateRef<{ $implicit: DashboardItemView }>>();
  /** False on narrow screens: items stack in reading order and cannot be moved. */
  readonly editable = input(true);

  readonly layoutChange = output<LayoutChange>();
  readonly remove = output<string>();

  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly draft = signal<ResizeDraft | null>(null);
  protected readonly announcement = signal('');

  /** Enough rows for every item, so the grid keeps its height while an item is dragged. */
  protected readonly rowTemplate = computed(() => {
    const rows = this.items().reduce(
      (max, item) => Math.max(max, item.layout.y + item.layout.height),
      1,
    );
    return `repeat(${rows}, ${ROW_HEIGHT_PX}px)`;
  });

  protected displayed(item: DashboardItemView): ItemLayout {
    const draft = this.draft();
    return draft?.id === item.id ? draft.layout : item.layout;
  }

  protected onDragEnded(event: CdkDragEnd, item: DashboardItemView): void {
    const { colStep, rowStep } = this.steps();
    const dx = Math.round(event.distance.x / colStep);
    const dy = Math.round(event.distance.y / rowStep);
    event.source.reset();
    if (dx || dy) {
      this.emit(item, { ...item.layout, x: item.layout.x + dx, y: item.layout.y + dy }, 'Moved');
    }
  }

  protected startResize(event: PointerEvent, item: DashboardItemView): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    this.draft.set({
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      start: item.layout,
      layout: item.layout,
    });
    const move = (e: PointerEvent) => {
      const draft = this.draft();
      if (!draft) return;
      const { colStep, rowStep } = this.steps();
      this.draft.set({
        ...draft,
        layout: clampLayout({
          ...draft.start,
          width: draft.start.width + Math.round((e.clientX - draft.startX) / colStep),
          height: draft.start.height + Math.round((e.clientY - draft.startY) / rowStep),
        }),
      });
    };
    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      const draft = this.draft();
      this.draft.set(null);
      if (
        draft &&
        (draft.layout.width !== draft.start.width || draft.layout.height !== draft.start.height)
      ) {
        this.emit(item, draft.layout, 'Resized');
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  protected onKeydown(event: KeyboardEvent, item: DashboardItemView): void {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    const [dx, dy] = step;
    const layout = item.layout;
    if (event.shiftKey) {
      this.emit(
        item,
        { ...layout, width: layout.width + dx, height: layout.height + dy },
        'Resized',
      );
    } else {
      this.emit(item, { ...layout, x: layout.x + dx, y: layout.y + dy }, 'Moved');
    }
  }

  private emit(item: DashboardItemView, layout: ItemLayout, verb: 'Moved' | 'Resized'): void {
    const next = clampLayout(layout);
    if (
      next.x === item.layout.x &&
      next.y === item.layout.y &&
      next.width === item.layout.width &&
      next.height === item.layout.height
    ) {
      return;
    }
    this.layoutChange.emit({ itemId: item.id, layout: next });
    this.announcement.set(
      verb === 'Moved'
        ? `${item.title} moved to column ${next.x + 1}, row ${next.y + 1}.`
        : `${item.title} resized to ${next.width} columns by ${next.height} rows.`,
    );
  }

  private steps(): { colStep: number; rowStep: number } {
    const width = this.grid().nativeElement.getBoundingClientRect().width;
    const colStep = width > 0 ? (width + GAP_PX) / GRID_COLUMNS : 1;
    return { colStep, rowStep: ROW_HEIGHT_PX + GAP_PX };
  }
}
