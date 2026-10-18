import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';

import type { ApiProblem, ChatSessionSummary } from '../../../../core/api';
import { ProblemMessage } from '../problem-message/problem-message';

/** Past chat sessions of a connection, most recently active first, as links. */
@Component({
  selector: 'app-session-list',
  imports: [DatePipe, RouterLink, ButtonDirective, Skeleton, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h3 id="sessions-heading">Chats</h3>
      <button pButton type="button" size="small" [outlined]="true" (click)="newChat.emit()">
        New chat
      </button>
    </div>
    <nav aria-labelledby="sessions-heading">
      @if (problem(); as p) {
        <app-problem-message [problem]="p" lead="Chat history could not be loaded." />
      } @else if (loading() && !sessions().length) {
        <div aria-hidden="true" class="skeletons">
          <p-skeleton height="2.5rem" /><p-skeleton height="2.5rem" />
        </div>
        <span class="visually-hidden" role="status">Loading chats…</span>
      } @else if (!sessions().length) {
        <p class="empty">No chats yet. Ask a question to start one.</p>
      } @else {
        <ul>
          @for (session of sessions(); track session.id) {
            <li>
              <a
                routerLink="."
                [queryParams]="{ session: session.id }"
                [class.active]="session.id === activeId()"
                [attr.aria-current]="session.id === activeId() ? 'page' : null"
              >
                <span class="title">{{ session.title || 'Untitled chat' }}</span>
                <span class="when">{{ session.lastActivityAt | date: 'short' }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </nav>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    h3 {
      margin: 0;
      font-size: 1rem;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
    a {
      display: flex;
      flex-direction: column;
      padding: 0.5rem 0.625rem;
      border-radius: var(--p-content-border-radius);
      color: inherit;
      text-decoration: none;
      &:hover {
        background: var(--p-content-hover-background);
      }
      &.active {
        background: var(--p-highlight-background);
        color: var(--p-highlight-color);
      }
    }
    .title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .when {
      font-size: 0.75rem;
      opacity: 0.8;
    }
    .empty {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .skeletons {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
  `,
})
export class SessionList {
  readonly sessions = input.required<readonly ChatSessionSummary[]>();
  readonly activeId = input<string | null>(null);
  readonly loading = input(false);
  readonly problem = input<ApiProblem | null>(null);

  readonly newChat = output();
}
