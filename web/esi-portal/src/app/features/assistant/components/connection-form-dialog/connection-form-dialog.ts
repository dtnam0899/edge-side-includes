import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';

import type { ApiProblem, Connection } from '../../../../core/api';
import { FocusReturn } from '../../helpers/focus-return';
import { ProblemMessage } from '../problem-message/problem-message';
import { ReadOnlyLoginNotice } from '../read-only-login-notice/read-only-login-notice';

export interface ConnectionFormValue {
  readonly name: string;
  /** Absent when editing without replacing the stored connection string. */
  readonly connectionString?: string;
}

/**
 * Add or edit a connection. The connection string is a masked, write-only field: it is never pre-filled, and it is
 * cleared whenever the dialog closes.
 */
@Component({
  selector: 'app-connection-form-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Dialog,
    InputText,
    ProblemMessage,
    ReadOnlyLoginNotice,
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
      [header]="isEdit() ? 'Edit connection' : 'Add a SQL Server connection'"
      [style]="{ width: 'min(36rem, calc(100vw - 2rem))' }"
    >
      <form id="connection-form" [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
        <app-read-only-login-notice />
        <div class="field">
          <label for="connection-name">Name</label>
          <input
            pInputText
            id="connection-name"
            formControlName="name"
            autocomplete="off"
            maxlength="200"
            [attr.aria-invalid]="showNameError()"
            aria-describedby="connection-name-error"
          />
          @if (showNameError()) {
            <small id="connection-name-error" class="error"
              >Enter a name (up to 200 characters).</small
            >
          }
        </div>
        <div class="field">
          <label for="connection-string">Connection string</label>
          <input
            pInputText
            id="connection-string"
            type="password"
            formControlName="connectionString"
            autocomplete="off"
            spellcheck="false"
            [attr.aria-invalid]="showSecretError()"
            aria-describedby="connection-string-help connection-string-error"
          />
          <small id="connection-string-help" class="help">
            @if (isEdit()) {
              Leave empty to keep the stored connection string.
            }
            Stored encrypted and never shown again. Format:
            <code>Server=…;Database=…;User Id=…;Password=…;Encrypt=True</code>
          </small>
          @if (showSecretError()) {
            <small id="connection-string-error" class="error">Enter the connection string.</small>
          }
        </div>
        @if (problem(); as p) {
          <app-problem-message [problem]="p" />
        }
      </form>
      <ng-template #footer>
        <button pButton type="button" severity="secondary" [text]="true" (click)="dismissed.emit()">
          Cancel
        </button>
        <button pButton type="submit" form="connection-form" [loading]="saving()">
          {{ isEdit() ? 'Save changes' : 'Add connection' }}
        </button>
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    label {
      font-weight: 600;
    }
    .help {
      color: var(--p-text-muted-color);
      overflow-wrap: anywhere;
    }
    .error {
      color: var(--p-red-600, #dc2626);
    }
  `,
})
export class ConnectionFormDialog {
  readonly visible = input(false);
  /** The connection being edited; `null` adds a new one. */
  readonly connection = input<Connection | null>(null);
  readonly saving = input(false);
  readonly problem = input<ApiProblem | null>(null);

  readonly saved = output<ConnectionFormValue>();
  readonly dismissed = output();

  protected readonly focusReturn = new FocusReturn();

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    connectionString: [''],
  });
  private submitted = false;

  protected readonly isEdit = computed(() => this.connection() !== null);

  constructor() {
    effect(() => {
      const visible = this.visible();
      const connection = this.connection();
      if (visible) {
        this.focusReturn.capture();
      }
      // Reset on every open and close so a typed secret never outlives the dialog.
      this.submitted = false;
      this.form.reset({ name: visible ? (connection?.name ?? '') : '', connectionString: '' });
      const secret = this.form.controls.connectionString;
      secret.setValidators(connection ? [] : [Validators.required]);
      secret.updateValueAndValidity();
    });
  }

  protected showNameError(): boolean {
    const name = this.form.controls.name;
    return name.invalid && (name.touched || this.submitted);
  }

  protected showSecretError(): boolean {
    const secret = this.form.controls.connectionString;
    return secret.invalid && (secret.touched || this.submitted);
  }

  protected submit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) {
      return;
    }
    const { name, connectionString } = this.form.getRawValue();
    this.saved.emit(
      connectionString ? { name: name.trim(), connectionString } : { name: name.trim() },
    );
  }
}
