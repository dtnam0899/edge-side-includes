import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import {
  ERD_HEADER_HEIGHT,
  ERD_ROW_HEIGHT,
  ErdColumn,
  ErdLayout,
  ErdNode,
} from '../../helpers/erd-layout';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 1.25;
const MIN_VIEWPORT_HEIGHT = 240;
const SCROLLBAR_ALLOWANCE = 18;

function maxViewportHeight(): number {
  return Math.max(MIN_VIEWPORT_HEIGHT, Math.round((globalThis.innerHeight || 1000) * 0.7));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Entity-relationship diagram of laid-out tables. Scroll or drag to pan, Ctrl/⌘ + wheel or the buttons to zoom.
 * Selecting a table highlights it and its relations; everything else is dimmed.
 */
@Component({
  selector: 'app-erd-diagram',
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar" role="group" aria-label="Zoom">
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        [outlined]="true"
        aria-label="Zoom out"
        [disabled]="zoom() <= minZoom"
        (click)="zoomBy(1 / zoomStep)"
      >
        <span aria-hidden="true">−</span>
      </button>
      <span class="zoom" aria-live="polite">{{ zoomPercent() }}%</span>
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        [outlined]="true"
        aria-label="Zoom in"
        [disabled]="zoom() >= maxZoom"
        (click)="zoomBy(zoomStep)"
      >
        <span aria-hidden="true">+</span>
      </button>
      <button pButton type="button" size="small" severity="secondary" [text]="true" (click)="fit()">
        Fit
      </button>
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        [text]="true"
        (click)="zoom.set(1)"
      >
        100%
      </button>
    </div>
    <div
      #viewport
      class="viewport"
      [style.height.px]="viewportHeight()"
      [class.dragging]="dragging()"
      (pointerdown)="startDrag($event)"
      (pointermove)="drag($event)"
      (pointerup)="endDrag()"
      (pointercancel)="endDrag()"
      (wheel)="wheel($event)"
    >
      <svg
        [attr.width]="layout().width * zoom()"
        [attr.height]="layout().height * zoom()"
        [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
        role="img"
        aria-label="Entity-relationship diagram; the table list beside it has the same content"
      >
        <defs>
          <marker
            id="erd-one"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" class="marker" />
          </marker>
        </defs>
        @for (edge of layout().edges; track edge.relation.from + edge.relation.name) {
          <path
            class="edge"
            [class.active]="isActiveEdge(edge.relation.from, edge.relation.to)"
            [class.dimmed]="selectedId() && !isActiveEdge(edge.relation.from, edge.relation.to)"
            [attr.d]="edge.path"
            marker-end="url(#erd-one)"
          >
            <title>
              {{ edge.relation.name }}: {{ edge.relation.from }} ({{
                edge.relation.fromColumns.join(', ')
              }}) → {{ edge.relation.to }} ({{ edge.relation.toColumns.join(', ') }})
            </title>
          </path>
        }
        @for (node of layout().nodes; track node.table.id) {
          <g
            class="node"
            [class.view]="node.table.kind === 'view'"
            [class.selected]="node.table.id === selectedId()"
            [class.dimmed]="selectedId() && !related().has(node.table.id)"
            [attr.transform]="'translate(' + node.x + ' ' + node.y + ')'"
            tabindex="0"
            role="button"
            [attr.aria-pressed]="node.table.id === selectedId()"
            [attr.aria-label]="(node.table.kind === 'view' ? 'View ' : 'Table ') + node.table.id"
            (click)="toggle(node)"
            (keydown.enter)="toggle(node)"
            (keydown.space)="$event.preventDefault(); toggle(node)"
          >
            <rect class="box" [attr.width]="node.width" [attr.height]="node.height" rx="6" />
            <path class="header" [attr.d]="headerPath(node)" />
            <text class="title" x="10" [attr.y]="headerHeight / 2" dominant-baseline="central">
              {{ short(node.table.id, 28) }}
              <title>{{ node.table.id }}</title>
            </text>
            @if (node.table.kind === 'view') {
              <text
                class="badge"
                [attr.x]="node.width - 10"
                [attr.y]="headerHeight / 2"
                dominant-baseline="central"
                text-anchor="end"
              >
                view
              </text>
            }
            @for (column of node.table.columns; track column.name; let i = $index) {
              <text
                class="column"
                [class.pk]="column.primaryKey"
                x="10"
                [attr.y]="headerHeight + i * rowHeight + rowHeight / 2"
                dominant-baseline="central"
              >
                <tspan class="key">{{ keyMark(column) }}</tspan>
                {{ short(column.name, 18) }}
                <title>
                  {{ column.name }} {{ column.sqlType }}{{ column.nullable ? '' : ' NOT NULL' }}
                </title>
              </text>
              <text
                class="type"
                [attr.x]="node.width - 10"
                [attr.y]="headerHeight + i * rowHeight + rowHeight / 2"
                dominant-baseline="central"
                text-anchor="end"
              >
                {{ short(column.sqlType, 14) }}
              </text>
            }
          </g>
        }
      </svg>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .zoom {
      min-width: 3.5rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
      color: var(--p-text-muted-color);
    }
    .viewport {
      overflow: auto;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background:
        radial-gradient(circle, var(--p-content-border-color) 1px, transparent 1px) 0 0 / 20px 20px,
        var(--p-content-background);
      cursor: grab;
      touch-action: none;
    }
    .viewport.dragging {
      cursor: grabbing;
      user-select: none;
    }
    svg {
      display: block;
      font-size: 12px;
    }
    .edge {
      fill: none;
      stroke: var(--p-text-muted-color);
      stroke-width: 1.5;
    }
    .edge.active {
      stroke: var(--p-primary-color);
      stroke-width: 2.5;
    }
    .marker {
      fill: var(--p-text-muted-color);
    }
    .dimmed {
      opacity: 0.25;
    }
    .node {
      cursor: pointer;
      outline: none;
    }
    .box {
      fill: var(--p-content-background);
      stroke: var(--p-content-border-color);
      stroke-width: 1;
    }
    .header {
      fill: var(--p-highlight-background);
    }
    .node.view .box {
      stroke-dasharray: 5 3;
    }
    .node.selected .box,
    .node:focus-visible .box {
      stroke: var(--p-primary-color);
      stroke-width: 2.5;
    }
    .title {
      font-weight: 600;
      fill: var(--p-highlight-color);
    }
    .badge {
      font-size: 11px;
      fill: var(--p-highlight-color);
    }
    .column {
      fill: var(--p-text-color);
    }
    .column.pk {
      font-weight: 600;
    }
    .key {
      fill: var(--p-primary-color);
      font-weight: 600;
    }
    .type {
      fill: var(--p-text-muted-color);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
    }
  `,
})
export class ErdDiagram {
  readonly layout = input.required<ErdLayout>();
  readonly selectedId = input<string | null>(null);
  /** The selected table and its directly related tables. */
  readonly related = input<ReadonlySet<string>>(new Set());
  readonly selectedIdChange = output<string | null>();

  protected readonly headerHeight = ERD_HEADER_HEIGHT;
  protected readonly rowHeight = ERD_ROW_HEIGHT;
  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly zoomStep = ZOOM_STEP;
  protected readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  protected readonly dragging = signal(false);
  /** Tall enough for the diagram (plus a scrollbar), between 15rem and 70% of the window. */
  protected readonly viewportHeight = computed(() =>
    Math.min(
      maxViewportHeight(),
      Math.max(MIN_VIEWPORT_HEIGHT, this.layout().height * this.zoom() + SCROLLBAR_ALLOWANCE),
    ),
  );
  protected readonly short = truncate;

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private dragStart: { x: number; y: number; left: number; top: number } | null = null;
  private moved = false;

  protected keyMark(column: ErdColumn): string {
    return column.primaryKey ? 'PK ' : column.foreignKey ? 'FK ' : '';
  }

  protected headerPath(node: ErdNode): string {
    const w = node.width;
    const h = ERD_HEADER_HEIGHT;
    return `M 0 6 Q 0 0 6 0 L ${w - 6} 0 Q ${w} 0 ${w} 6 L ${w} ${h} L 0 ${h} Z`;
  }

  protected isActiveEdge(from: string, to: string): boolean {
    const id = this.selectedId();
    return !!id && (from === id || to === id);
  }

  protected toggle(node: ErdNode): void {
    if (this.moved) return;
    this.selectedIdChange.emit(node.table.id === this.selectedId() ? null : node.table.id);
  }

  protected zoomBy(factor: number): void {
    this.zoom.update((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }

  /** Zooms so the whole diagram fits the viewport, never above 100%. */
  protected fit(): void {
    const el = this.viewport().nativeElement;
    const { width, height } = this.layout();
    if (!width || !height || !el.clientWidth) return;
    const room = maxViewportHeight() - SCROLLBAR_ALLOWANCE;
    const scale = Math.min((el.clientWidth - SCROLLBAR_ALLOWANCE) / width, room / height, 1);
    this.zoom.set(Math.max(MIN_ZOOM, scale));
  }

  protected wheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  }

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const el = this.viewport().nativeElement;
    this.dragStart = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    this.moved = false;
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragStart) return;
    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    if (!this.moved && Math.hypot(dx, dy) < 4) return;
    if (!this.moved) {
      this.moved = true;
      this.dragging.set(true);
      this.viewport().nativeElement.setPointerCapture?.(event.pointerId);
    }
    const el = this.viewport().nativeElement;
    el.scrollLeft = this.dragStart.left - dx;
    el.scrollTop = this.dragStart.top - dy;
  }

  protected endDrag(): void {
    this.dragStart = null;
    this.dragging.set(false);
    // A click follows pointerup; let it see `moved` once, then reset.
    setTimeout(() => (this.moved = false));
  }
}
