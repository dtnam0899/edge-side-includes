import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ChatComposer } from '../../components/chat-composer/chat-composer';
import { NameDialog } from '../../components/name-dialog/name-dialog';
import { ChatThread, RunRequest } from '../../components/chat-thread/chat-thread';
import { ProblemMessage } from '../../components/problem-message/problem-message';
import { SessionList } from '../../components/session-list/session-list';
import type { ChatMessage } from '../../../../core/api';
import { ChatService } from '../../services/chat.service';

/**
 * Chat of one connection: sessions beside the open conversation. Owns its `ChatService`, so removing the panel
 * (for example when consent is withdrawn) drops every loaded message and result at once.
 */
@Component({
  selector: 'app-chat-panel',
  imports: [ChatComposer, NameDialog, ChatThread, ProblemMessage, SessionList],
  providers: [ChatService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chat">
      <aside class="sessions">
        <app-session-list
          [sessions]="chat.sessions()"
          [activeId]="chat.activeSessionId()"
          [loading]="chat.sessionsLoading()"
          [problem]="chat.sessionsProblem()"
          (newChat)="newChat()"
        />
      </aside>
      <section class="conversation" aria-label="Chat">
        @if (chat.sessionProblem(); as problem) {
          <app-problem-message [problem]="problem" lead="This chat could not be opened." />
        } @else if (chat.sessionLoading()) {
          <p role="status" class="muted">Loading the chat…</p>
        } @else if (!chat.messages().length && !chat.pendingQuestion() && !chat.failedQuestion()) {
          <p class="muted">
            @if (chat.activeSessionId()) {
              This chat has no messages yet. Ask a question below.
            } @else {
              Ask a question to start a new chat about this database.
            }
          </p>
        }
        <app-chat-thread
          [messages]="chat.messages()"
          [pendingQuestion]="chat.pendingQuestion()"
          [failedQuestion]="chat.failedQuestion()"
          [executions]="chat.executions()"
          [visualizations]="chat.visualizations()"
          [saves]="chat.saves()"
          (visualize)="chat.visualize($event.message, $event.intent)"
          (saveVisualization)="naming.set($event)"
          (run)="run($event)"
          (retry)="send($event)"
        />
        <app-chat-composer
          [sending]="chat.pendingQuestion() !== null"
          [disabled]="chat.sessionLoading() || chat.sessionProblem() !== null"
          (send)="send($event)"
        />
      </section>
    </div>
    <app-name-dialog
      [visible]="naming() !== null"
      header="Save visualization"
      label="Name"
      submitLabel="Save"
      [initialName]="defaultName()"
      (saved)="saveAs($event)"
      (dismissed)="naming.set(null)"
    />
  `,
  styles: `
    .chat {
      display: grid;
      grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;
    }
    .conversation {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    @media (max-width: 64rem) {
      .chat {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class ChatPanel {
  readonly connectionId = input.required<string>();
  /** Session from the URL (`?session=`); `null` is a new chat. */
  readonly sessionId = input<string | null>(null);

  protected readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** The answer whose visualization is being named before it is saved. */
  protected readonly naming = signal<ChatMessage | null>(null);
  /** The question that led to the answer, as a starting name. */
  protected readonly defaultName = computed(() => {
    const answer = this.naming();
    const messages = this.chat.messages();
    const index = answer ? messages.findIndex((m) => m.id === answer.id) : -1;
    const question = index > 0 ? messages[index - 1] : undefined;
    return question?.role === 'user' ? question.text.slice(0, 120) : '';
  });

  constructor() {
    effect(() => {
      const connectionId = this.connectionId();
      const sessionId = this.sessionId();
      untracked(() => {
        this.chat.setConnection(connectionId);
        this.chat.openSession(sessionId);
      });
    });
  }

  protected newChat(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { session: null },
      queryParamsHandling: 'merge',
    });
    this.chat.openSession(null);
  }

  protected send(text: string): void {
    const wasNew = this.chat.activeSessionId() === null;
    this.chat
      .send(text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sessionId) => {
        if (wasNew) {
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { session: sessionId },
            queryParamsHandling: 'merge',
          });
        }
      });
  }

  protected run(request: RunRequest): void {
    this.chat.run(request.message, request.page);
  }

  protected saveAs(name: string): void {
    const message = this.naming();
    this.naming.set(null);
    if (message) this.chat.saveArtifact(message, name);
  }
}
