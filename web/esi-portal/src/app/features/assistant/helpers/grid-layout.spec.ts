import {
  GRID_COLUMNS,
  PlacedItem,
  applyLayout,
  clampLayout,
  compact,
  hasOverlaps,
  nextLayout,
  readingOrder,
  sameLayouts,
} from './grid-layout';

const item = (id: string, x: number, y: number, width: number, height: number): PlacedItem => ({
  id,
  layout: { x, y, width, height },
});

describe('grid layout', () => {
  it('keeps layouts inside the 12-column grid and the size limits', () => {
    expect(clampLayout({ x: 11, y: -2, width: 6, height: 1 })).toEqual({
      x: 6,
      y: 0,
      width: 6,
      height: 2,
    });
    expect(clampLayout({ x: -1, y: 0, width: 40, height: 99 })).toEqual({
      x: 0,
      y: 0,
      width: GRID_COLUMNS,
      height: 12,
    });
  });

  it('pushes overlapped items down and closes the gaps', () => {
    const items = [item('a', 0, 0, 6, 2), item('b', 6, 0, 6, 2), item('c', 0, 2, 6, 2)];
    const next = applyLayout(items, 'c', { x: 6, y: 0, width: 6, height: 2 });
    expect(next).toEqual([item('a', 0, 0, 6, 2), item('c', 6, 0, 6, 2), item('b', 6, 2, 6, 2)]);
  });

  it('moves an item sideways without jumping over items above it', () => {
    const items = [item('a', 0, 0, 3, 4), item('b', 3, 0, 9, 4), item('c', 0, 4, 6, 3)];
    const next = applyLayout(items, 'c', { x: 2, y: 4, width: 6, height: 3 });
    expect(next.find((i) => i.id === 'c')?.layout).toEqual({ x: 2, y: 4, width: 6, height: 3 });
    expect(next.find((i) => i.id === 'b')?.layout.y).toBe(0);
  });

  it('floats a moved item up when the space above is free', () => {
    const next = applyLayout([item('a', 0, 0, 3, 2), item('b', 6, 0, 3, 2)], 'b', {
      x: 6,
      y: 5,
      width: 3,
      height: 2,
    });
    expect(next.find((i) => i.id === 'b')?.layout.y).toBe(0);
  });

  it('never leaves overlapping items, whatever the sequence of changes', () => {
    let seed = 7;
    const random = (n: number) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    let items: PlacedItem[] = Array.from({ length: 6 }, (_, i) =>
      item(`i${i}`, (i % 2) * 6, Math.floor(i / 2) * 3, 6, 3),
    );
    for (let step = 0; step < 300; step++) {
      const target = items[random(items.length)];
      items = applyLayout(items, target.id, {
        x: random(12),
        y: random(12),
        width: 2 + random(10),
        height: 2 + random(6),
      });
      expect(hasOverlaps(items)).toBe(false);
      expect(items).toHaveLength(6);
    }
  });

  it('detects overlapping items', () => {
    expect(hasOverlaps([item('a', 0, 0, 4, 2), item('b', 3, 1, 4, 2)])).toBe(true);
    expect(hasOverlaps([item('a', 0, 0, 4, 2), item('b', 4, 0, 4, 2)])).toBe(false);
  });

  it('places a new item below the others with a size for its kind', () => {
    const items = [item('a', 0, 0, 6, 5), item('b', 6, 0, 3, 2)];
    expect(nextLayout(items, 'kpi')).toEqual({ x: 0, y: 5, width: 3, height: 2 });
    expect(nextLayout([], 'table')).toEqual({ x: 0, y: 0, width: 6, height: 5 });
    // Charts and kinds a later contract adds (ADR-0010) get the table size.
    expect(nextLayout([], 'chart')).toEqual({ x: 0, y: 0, width: 6, height: 5 });
    expect(nextLayout([], 'form')).toEqual({ x: 0, y: 0, width: 6, height: 5 });
  });

  it('sorts in reading order and compares layouts by item', () => {
    const items = [item('b', 6, 0, 3, 2), item('c', 0, 4, 3, 2), item('a', 0, 0, 3, 2)];
    expect(readingOrder(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(sameLayouts(items, readingOrder(items))).toBe(true);
    expect(sameLayouts(items, compact(items))).toBe(false);
  });
});
