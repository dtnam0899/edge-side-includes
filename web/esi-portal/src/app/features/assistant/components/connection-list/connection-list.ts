import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';

import type { ApiProblem, Connection } from '../../../../core/api';
import { ProblemMessage } from '../problem-message/problem-message';

/** The user's connections as navigation links; withdrawn consent is labelled, never hidden. */
@Component({
  selector: 'app-connection-list',
  imports: [RouterLink, ButtonDirective, Skeleton, Tag, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (problem(); as p) {
      <app-problem-message [problem]="p" lead="Your connections could not be loaded." />
      <button pButton type="button" severity="secondary" [outlined]="true" (click)="retry.emit()">
        Try again
      </button>
    } @else if (loading() && !connections().length) {
      <div aria-hidden="true" class="skeletons">
        <p-skeleton height="3rem" />
        <p-skeleton height="3rem" />
      </div>
      <span class="visually-hidden" role="status">Loading connections…</span>
    } @else if (!connections().length) {
      <p class="empty">No connections yet.</p>
    } @else {
      <ul class="list">
        @for (connection of connections(); track connection.id) {
          <li>
            <a
              [routerLink]="['connections', connection.id]"
              [class.selected]="connection.id === selectedId()"
              [attr.aria-current]="connection.id === selectedId() ? 'page' : null"
            >
              <span class="name">{{ connection.name }}</span>
              <span class="where">{{ connection.server }} · {{ connection.database }}</span>
              @if (connection.consent === 'withdrawn') {
                <p-tag severity="secondary" value="Consent withdrawn" styleClass="tag" />
              }
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    a {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;
      padding: 0.625rem 0.75rem;
      border-radius: var(--p-content-border-radius);
      color: inherit;
      text-decoration: none;
      border: 1px solid transparent;
      &:hover {
        background: var(--p-content-hover-background);
      }
      &.selected {
        background: var(--p-highlight-background);
        color: var(--p-highlight-color);
        border-color: var(--p-primary-color);
      }
    }
    .name {
      font-weight: 600;
    }
    .where {
      font-size: 0.875rem;
      color: var(--p-text-muted-color);
      overflow-wrap: anywhere;
    }
    .selected .where {
      color: inherit;
    }
    .skeletons {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .empty {
      color: var(--p-text-muted-color);
      margin: 0;
    }
  `,
})
export class ConnectionList {
  readonly connections = input.required<readonly Connection[]>();
  readonly selectedId = input<string | null>(null);
  readonly loading = input(false);
  readonly problem = input<ApiProblem | null>(null);

  readonly retry = output();
}
