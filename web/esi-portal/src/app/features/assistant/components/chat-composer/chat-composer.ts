import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Textarea } from 'primeng/textarea';

const MAX_LENGTH = 4000;

/** Question input. Enter with Ctrl or Cmd sends; plain Enter adds a line. */
@Component({
  selector: 'app-chat-composer',
  imports: [ButtonDirective, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="composer" (submit)="$event.preventDefault(); submit()">
      <label for="chat-question" class="label">Ask a question about this database</label>
      <textarea
        pTextarea
        id="chat-question"
        name="question"
        rows="3"
        [attr.maxlength]="maxLength"
        [value]="text()"
        (input)="onInput($event)"
        (keydown.control.enter)="submit()"
        (keydown.meta.enter)="submit()"
        [disabled]="disabled()"
        aria-describedby="chat-question-hint"
        placeholder="For example: total revenue per customer in 2026"
      ></textarea>
      <div class="row">
        <small id="chat-question-hint" class="hint">
          The assistant answers with SQL for you to review. Nothing runs until you choose “Run
          query”. Ctrl+Enter sends.
        </small>
        <button
          pButton
          type="submit"
          [loading]="sending()"
          [disabled]="disabled() || !text().trim()"
        >
          Ask
        </button>
      </div>
    </form>
  `,
  styles: `
    .composer {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .label {
      font-weight: 600;
    }
    textarea {
      width: 100%;
      resize: vertical;
    }
    .row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }
    .hint {
      color: var(--p-text-muted-color);
    }
  `,
})
export class ChatComposer {
  readonly disabled = input(false);
  readonly sending = input(false);

  readonly send = output<string>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly text = signal('');

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    const question = this.text().trim();
    if (!question || this.disabled() || this.sending()) {
      return;
    }
    this.send.emit(question);
    this.text.set('');
  }
}
