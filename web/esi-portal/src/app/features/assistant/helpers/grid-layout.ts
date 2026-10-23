import type { ItemLayout } from '../../../core/api';

/** Columns of the dashboard grid. Positions and sizes are in grid cells. */
export const GRID_COLUMNS = 12;
export const MIN_WIDTH = 2;
export const MIN_HEIGHT = 2;
export const MAX_HEIGHT = 12;

export interface PlacedItem {
  readonly id: string;
  readonly layout: ItemLayout;
}

function overlaps(a: ItemLayout, b: ItemLayout): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** True when any two items overlap. */
export function hasOverlaps(items: readonly PlacedItem[]): boolean {
  return items.some((a, i) => items.some((b, j) => i < j && overlaps(a.layout, b.layout)));
}

/** Keeps a layout inside the grid and within the size limits. */
export function clampLayout(layout: ItemLayout): ItemLayout {
  const width = Math.min(Math.max(Math.round(layout.width), MIN_WIDTH), GRID_COLUMNS);
  const height = Math.min(Math.max(Math.round(layout.height), MIN_HEIGHT), MAX_HEIGHT);
  const x = Math.min(Math.max(Math.round(layout.x), 0), GRID_COLUMNS - width);
  const y = Math.max(Math.round(layout.y), 0);
  return { x, y, width, height };
}

/** Top to bottom, then left to right (the order core returns and screen readers follow). */
export function readingOrder<T extends PlacedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);
}

/**
 * Applies a new layout to one item and pushes overlapping items down until nothing overlaps; then moves every
 * item up as far as it can go, so the grid has no gaps.
 */
export function applyLayout<T extends PlacedItem>(
  items: readonly T[],
  id: string,
  layout: ItemLayout,
): T[] {
  const changed = items.find((item) => item.id === id);
  if (!changed) {
    return [...items];
  }
  const placed: T[] = [{ ...changed, layout: clampLayout(layout) }];
  for (const item of readingOrder(items.filter((i) => i.id !== id))) {
    let candidate = item.layout;
    while (placed.some((p) => overlaps(p.layout, candidate))) {
      candidate = { ...candidate, y: candidate.y + 1 };
    }
    placed.push({ ...item, layout: candidate });
  }
  // Others reflow around the changed item first; then every item, the changed one included, closes the gaps
  // above it without jumping over items that are higher up.
  return compact(compact(placed, id));
}

/**
 * Closes gaps: in reading order, each item moves down until it overlaps nothing placed before it, then up as
 * far as it can. `pinned` is placed first and stays exactly where it is.
 */
export function compact<T extends PlacedItem>(items: readonly T[], pinned?: string): T[] {
  const pinnedItem = items.find((item) => item.id === pinned);
  const result: T[] = pinnedItem ? [pinnedItem] : [];
  for (const item of readingOrder(items.filter((i) => i.id !== pinned))) {
    let layout = item.layout;
    while (result.some((p) => overlaps(p.layout, layout))) {
      layout = { ...layout, y: layout.y + 1 };
    }
    while (
      layout.y > 0 &&
      !result.some((p) => overlaps(p.layout, { ...layout, y: layout.y - 1 }))
    ) {
      layout = { ...layout, y: layout.y - 1 };
    }
    result.push({ ...item, layout });
  }
  return readingOrder(result);
}

/**
 * Layout for a new item: the default size for its kind, below everything else. A KPI is 3 x 2; a table, a
 * chart (product owner, ADR-0010) and any kind this portal does not know yet are 6 x 5.
 */
export function nextLayout(items: readonly PlacedItem[], kind: string): ItemLayout {
  const bottom = items.reduce((max, item) => Math.max(max, item.layout.y + item.layout.height), 0);
  return kind === 'kpi'
    ? { x: 0, y: bottom, width: 3, height: 2 }
    : { x: 0, y: bottom, width: 6, height: 5 };
}

/** True when two lists hold the same layouts for the same items. */
export function sameLayouts(a: readonly PlacedItem[], b: readonly PlacedItem[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((item) => [item.id, item.layout]));
  return a.every((item) => {
    const other = byId.get(item.id);
    return (
      !!other &&
      other.x === item.layout.x &&
      other.y === item.layout.y &&
      other.width === item.layout.width &&
      other.height === item.layout.height
    );
  });
}
