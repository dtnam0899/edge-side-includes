import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DashboardSummary } from '../../../../core/api';

/** Dashboards of a connection, most recently changed first. */
@Component({
  selector: 'app-dashboard-list',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!dashboards().length) {
      <p class="empty">No dashboards yet. Create one and add saved visualizations to it.</p>
    } @else {
      <ul>
        @for (dashboard of dashboards(); track dashboard.id) {
          <li>
            <a [routerLink]="['dashboards', dashboard.id]">
              <span class="name">{{ dashboard.name }}</span>
              <span class="meta">
                {{ dashboard.itemCount }} {{ dashboard.itemCount === 1 ? 'item' : 'items' }},
                changed
                {{ dashboard.updatedAt | date: 'medium' }}
              </span>
            </a>
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
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.75rem;
    }
    a {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.875rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      color: inherit;
      text-decoration: none;
      &:hover {
        background: var(--p-content-hover-background);
      }
    }
    .name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .meta,
    .empty {
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
    }
    .empty {
      margin: 0;
    }
  `,
})
export class DashboardList {
  readonly dashboards = input.required<readonly DashboardSummary[]>();
}
