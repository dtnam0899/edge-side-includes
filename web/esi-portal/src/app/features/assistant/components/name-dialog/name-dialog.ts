import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

import type { ApiProblem } from '../../../../core/api';
import { FocusReturn } from '../../helpers/focus-return';
import { ProblemMessage } from '../problem-message/problem-message';

/** Asks for a name (save a visualization, create or rename a dashboard). */
@Component({
  selector: 'app-name-dialog',
  imports: [ReactiveFormsModule, ButtonDirective, Dialog, InputText, ProblemMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="$event || dismissed.emit()"
      (onHide)="focusReturn.restore()"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [header]="header()"
      [style]="{ width: 'min(28rem, calc(100vw - 2rem))' }"
    >
      <form id="name-form" [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
        <label for="name-input">{{ label() }}</label>
        <input
          pInputText
          id="name-input"
          formControlName="name"
          autocomplete="off"
          maxlength="200"
          [attr.aria-invalid]="showError()"
          aria-describedby="name-error"
        />
        @if (showError()) {
          <small id="name-error" class="error">Enter a name (up to 200 characters).</small>
        }
        @if (problem(); as p) {
          <app-problem-message [problem]="p" />
        }
      </form>
      <ng-template #footer>
        <button pButton type="button" severity="secondary" [text]="true" (click)="dismissed.emit()">
          Cancel
        </button>
        <button pButton type="submit" form="name-form" [loading]="saving()">
          {{ submitLabel() }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    label {
      font-weight: 600;
    }
    .error {
      color: var(--p-red-600, #dc2626);
    }
  `,
})
export class NameDialog {
  readonly visible = input(false);
  readonly header = input.required<string>();
  readonly label = input('Name');
  readonly submitLabel = input('Save');
  readonly initialName = input('');
  readonly saving = input(false);
  readonly problem = input<ApiProblem | null>(null);

  readonly saved = output<string>();
  readonly dismissed = output();

  protected readonly focusReturn = new FocusReturn();
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
  });
  private submitted = false;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.focusReturn.capture();
      }
      this.submitted = false;
      this.form.reset({ name: this.initialName() });
    });
  }

  protected showError(): boolean {
    const name = this.form.controls.name;
    return name.invalid && (name.touched || this.submitted);
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saved.emit(this.form.getRawValue().name.trim());
  }
}
