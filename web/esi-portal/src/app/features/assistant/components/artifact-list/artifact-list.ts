import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';

import type { ArtifactSummary } from '../../../../core/api';
import { artifactKindLabel } from '../../helpers/artifact-kind';
import { artifactStatusLabel } from '../../helpers/artifact-status';

/** Saved visualizations of a connection; each opens with live data. */
@Component({
  selector: 'app-artifact-list',
  imports: [DatePipe, RouterLink, ButtonDirective, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!artifacts().length) {
      <p class="empty">
        No saved visualizations. Run a query in the chat, ask for a table or KPI, and save it.
      </p>
    } @else {
      <ul>
        @for (artifact of artifacts(); track artifact.id) {
          <li>
            <div class="main">
              <a [routerLink]="['artifacts', artifact.id]" class="name">{{ artifact.name }}</a>
              <div class="meta">
                <p-tag severity="secondary" [value]="kindLabel(artifact.kind)" />
                @if (artifact.status !== 'available') {
                  <p-tag severity="warn" [value]="statusLabel(artifact.status)" />
                }
                <small>Saved {{ artifact.createdAt | date: 'medium' }}</small>
              </div>
            </div>
            <button
              pButton
              type="button"
              size="small"
              severity="danger"
              [text]="true"
              [attr.aria-label]="'Delete ' + artifact.name"
              [loading]="deletingId() === artifact.id"
              (click)="remove.emit(artifact)"
            >
              Delete
            </button>
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
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    li {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      min-width: 0;
    }
    .name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    small,
    .empty {
      color: var(--p-text-muted-color);
    }
    .empty {
      margin: 0;
    }
  `,
})
export class ArtifactList {
  readonly artifacts = input.required<readonly ArtifactSummary[]>();
  readonly deletingId = input<string | null>(null);

  readonly remove = output<ArtifactSummary>();

  protected readonly statusLabel = artifactStatusLabel;
  protected readonly kindLabel = artifactKindLabel;
}
