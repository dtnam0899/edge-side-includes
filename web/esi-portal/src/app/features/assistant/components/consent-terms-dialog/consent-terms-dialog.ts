import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Tag } from 'primeng/tag';

import type { ApiProblem, ConsentTerms } from '../../../../core/api';
import { toTermsBlocks } from '../../helpers/terms-blocks';
import { FocusReturn } from '../../helpers/focus-return';
import { ProblemMessage } from '../problem-message/problem-message';

/** The consent terms with an explicit "I accept" step. Shown before a connection is added or used. */
@Component({
  selector: 'app-consent-terms-dialog',
  imports: [
    DatePipe,
    FormsModule,
    ButtonDirective,
    Checkbox,
    Dialog,
    Message,
    ProgressSpinner,
    Tag,
    ProblemMessage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="$event || dismissed.emit()"
      (onHide)="focusReturn.restore()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      header="Data access and security terms"
      [style]="{ width: 'min(46rem, calc(100vw - 2rem))' }"
    >
      @if (terms(); as t) {
        <div class="meta">
          <span>Version {{ t.version }}, published {{ t.publishedAt | date: 'mediumDate' }}</span>
          @if (t.status === 'draft') {
            <p-tag severity="warn" value="Draft" />
          }
        </div>
        @if (t.status === 'draft') {
          <p class="draft-note">
            These terms are a draft that an administrator has not approved for production. Use only
            test or local databases.
          </p>
        }
        @if (outdated()) {
          <p-message severity="info" styleClass="outdated">
            The terms changed since you last accepted them. Accept this version to keep using your
            connections.
          </p-message>
        }
        <section class="terms" tabindex="0" aria-label="Terms text">
          @for (block of blocks(); track $index) {
            @switch (block.kind) {
              @case ('heading') {
                @if (block.level === 1) {
                  <h3>{{ block.text }}</h3>
                } @else {
                  <h4>{{ block.text }}</h4>
                }
              }
              @case ('note') {
                <p class="note">{{ block.text }}</p>
              }
              @case ('list') {
                <ul>
                  @for (item of block.items; track $index) {
                    <li>{{ item }}</li>
                  }
                </ul>
              }
              @default {
                <p>{{ block.text }}</p>
              }
            }
          }
        </section>
        <div class="confirm">
          <p-checkbox
            inputId="consent-read"
            [binary]="true"
            [ngModel]="read()"
            (ngModelChange)="read.set($event)"
          />
          <label for="consent-read"
            >I have read and accept these terms (version {{ t.version }})</label
          >
        </div>
      } @else if (loading()) {
        <div class="loading" role="status">
          <p-progressspinner styleClass="spinner" strokeWidth="6" ariaLabel="Loading terms" />
          <span>Loading the terms…</span>
        </div>
      }
      @if (problem(); as p) {
        <app-problem-message [problem]="p" />
      }
      <ng-template #footer>
        <button pButton type="button" severity="secondary" [text]="true" (click)="dismissed.emit()">
          Cancel
        </button>
        <button
          pButton
          type="button"
          [disabled]="!canAccept()"
          [loading]="accepting()"
          (click)="accepted.emit()"
        >
          Accept terms
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      color: var(--p-text-muted-color);
    }
    .draft-note {
      margin: 0.5rem 0 0.75rem;
    }
    .terms {
      max-height: 45vh;
      overflow: auto;
      margin: 0.75rem 0;
      padding: 0.75rem 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      h3 {
        margin: 0.25rem 0 0.5rem;
        font-size: 1.1rem;
      }
      h4 {
        margin: 1rem 0 0.25rem;
        font-size: 1rem;
      }
      p,
      ul {
        margin: 0.25rem 0;
        line-height: 1.5;
      }
      .note {
        padding-left: 0.75rem;
        border-left: 3px solid var(--p-content-border-color);
        color: var(--p-text-muted-color);
      }
    }
    .confirm {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .loading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    :host ::ng-deep .spinner {
      width: 2rem;
      height: 2rem;
    }
  `,
})
export class ConsentTermsDialog {
  readonly visible = input(false);
  readonly terms = input<ConsentTerms | null>(null);
  readonly outdated = input(false);
  readonly loading = input(false);
  readonly accepting = input(false);
  readonly problem = input<ApiProblem | null>(null);

  readonly accepted = output();
  readonly dismissed = output();

  protected readonly focusReturn = new FocusReturn();

  protected readonly read = signal(false);
  protected readonly blocks = computed(() => toTermsBlocks(this.terms()?.text ?? ''));
  protected readonly canAccept = computed(
    () => this.read() && this.terms() !== null && !this.accepting(),
  );

  constructor() {
    // Every opening (and every new terms version) needs a fresh, explicit acceptance.
    effect(() => {
      if (this.visible()) {
        this.focusReturn.capture();
      }
      this.terms();
      this.read.set(false);
    });
  }
}
