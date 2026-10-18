import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { DashboardItemView } from '../../services/dashboard.service';
import { DashboardGrid, LayoutChange } from './dashboard-grid';

const items: DashboardItemView[] = [
  {
    id: 'a',
    artifactId: 'x',
    layout: { x: 0, y: 0, width: 3, height: 2 },
    status: 'available',
    title: 'Revenue',
    kind: 'kpi',
    renderer: null,
  },
  {
    id: 'b',
    artifactId: 'y',
    layout: { x: 3, y: 0, width: 6, height: 4 },
    status: 'missing',
    title: 'Gone',
    kind: null,
    renderer: null,
  },
];

@Component({
  imports: [DashboardGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content let-item
      ><span class="content">{{ item.title }}</span></ng-template
    >
    <app-dashboard-grid
      [items]="items"
      [itemTemplate]="content"
      [editable]="editable()"
      (layoutChange)="changes.push($event)"
      (remove)="removed.push($event)"
    />
  `,
})
class Host {
  items = items;
  editable = signal(true);
  changes: LayoutChange[] = [];
  removed: string[] = [];
}

describe('DashboardGrid', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }
  const key = (el: HTMLElement, label: string, k: string, shiftKey = false) =>
    el
      .querySelector<HTMLButtonElement>(`button[aria-label="Move or resize ${label}"]`)!
      .dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true }));

  it('places each item in its own wrapper on the grid', async () => {
    const { el } = await render();
    const articles = el.querySelectorAll<HTMLElement>('article');
    expect(articles).toHaveLength(2);
    expect(articles[1].style.gridColumn).toBe('4 / span 6');
    expect(articles[1].style.gridRow).toBe('1 / span 4');
    expect(articles[0].querySelector('.content')?.textContent).toBe('Revenue');
  });

  it('moves with the arrow keys and resizes with Shift, inside the grid', async () => {
    const { fixture, host, el } = await render();
    key(el, 'Revenue', 'ArrowRight');
    key(el, 'Revenue', 'ArrowDown', true);
    key(el, 'Revenue', 'ArrowLeft');
    key(el, 'Revenue', 'ArrowUp');
    await fixture.whenStable();
    expect(host.changes).toEqual([
      { itemId: 'a', layout: { x: 1, y: 0, width: 3, height: 2 } },
      { itemId: 'a', layout: { x: 0, y: 0, width: 3, height: 3 } },
    ]);
    expect(el.querySelector('p[aria-live]')?.textContent).toContain(
      'Revenue resized to 3 columns by 3 rows.',
    );
  });

  it('removes an item', async () => {
    const { host, el } = await render();
    el.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Gone from the dashboard"]',
    )!.click();
    expect(host.removed).toEqual(['b']);
  });

  it('offers no move or resize controls when not editable', async () => {
    const { fixture, host, el } = await render();
    host.editable.set(false);
    await fixture.whenStable();
    expect(el.querySelector('button[aria-label^="Move or resize"]')).toBeNull();
    expect(el.querySelector('.resize')).toBeNull();
  });
});
