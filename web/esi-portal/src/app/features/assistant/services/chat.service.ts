import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subscription,
  catchError,
  finalize,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import {
  ApiProblem,
  Artifact,
  ChatMessage,
  ChatSessionSummary,
  QueryResult,
  Visualization,
  VisualizationIntent,
  toApiProblem,
} from '../../../core/api';
import { ArtifactsApi } from '../apis/artifacts.api';
import { ChatApi } from '../apis/chat.api';
import { ExecutionsApi } from '../apis/executions.api';
import { isConsentWithdrawn, needsTermsAcceptance } from '../helpers/problem-message';
import { RendererArtifact, toRendererArtifact } from '../helpers/dsl-adapter';
import { ResultPage, toResultPage } from '../helpers/query-page';
import { ConnectionsService } from './connections.service';
import { ConsentService } from './consent.service';

/** State of running one assistant answer's SELECT. Only `success` means the SQL ran and produced `result`. */
export type ExecutionState =
  | { readonly status: 'running'; readonly pageNumber: number; readonly result?: ResultPage }
  | { readonly status: 'success'; readonly result: ResultPage; readonly raw: QueryResult }
  | { readonly status: 'failure'; readonly pageNumber: number; readonly problem: ApiProblem };

/** A table, KPI or chart requested for one answer's result. Only `ready` has a validated document. */
export type VisualizationState =
  | { readonly status: 'pending'; readonly intent: VisualizationIntent }
  | {
      readonly status: 'ready';
      readonly intent: VisualizationIntent;
      readonly visualization: Visualization;
      readonly renderer: RendererArtifact;
    }
  | {
      readonly status: 'failure';
      readonly intent: VisualizationIntent;
      readonly problem: ApiProblem;
    };

/** Saving a ready visualization as an artifact. */
export type SaveState =
  | { readonly status: 'saving' }
  | { readonly status: 'saved'; readonly artifact: Artifact }
  | { readonly status: 'failure'; readonly problem: ApiProblem };

export interface FailedQuestion {
  readonly text: string;
  readonly problem: ApiProblem;
}

/**
 * Chat of one connection: its sessions, the open session's messages, the question in progress, and the
 * execution state of generated queries. Provided by the chat panel, so its state disappears with the panel
 * (for example the moment consent is withdrawn).
 */
@Injectable()
export class ChatService {
  private readonly chatApi = inject(ChatApi);
  private readonly executionsApi = inject(ExecutionsApi);
  private readonly artifactsApi = inject(ArtifactsApi);
  private readonly connections = inject(ConnectionsService);
  private readonly consent = inject(ConsentService);
  private readonly destroyRef = inject(DestroyRef);

  private connectionId = '';
  private sessionSubscription: Subscription | null = null;
  private readonly runSubscriptions = new Map<string, Subscription>();

  readonly sessions = signal<readonly ChatSessionSummary[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsProblem = signal<ApiProblem | null>(null);

  readonly activeSessionId = signal<string | null>(null);
  readonly messages = signal<readonly ChatMessage[]>([]);
  readonly sessionLoading = signal(false);
  readonly sessionProblem = signal<ApiProblem | null>(null);

  /** The question being answered right now. */
  readonly pendingQuestion = signal<string | null>(null);
  readonly failedQuestion = signal<FailedQuestion | null>(null);

  readonly executions = signal<ReadonlyMap<string, ExecutionState>>(new Map());
  readonly visualizations = signal<ReadonlyMap<string, VisualizationState>>(new Map());
  readonly saves = signal<ReadonlyMap<string, SaveState>>(new Map());

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelAll());
  }

  /** Switches to a connection and clears everything that belonged to the previous one. */
  setConnection(connectionId: string): void {
    if (connectionId === this.connectionId) {
      return;
    }
    this.cancelAll();
    this.connectionId = connectionId;
    this.sessions.set([]);
    this.sessionsProblem.set(null);
    this.resetSession(null);
    this.loadSessions();
  }

  loadSessions(): void {
    this.sessionsLoading.set(true);
    this.sessionsProblem.set(null);
    this.chatApi
      .listSessions(this.connectionId)
      .pipe(
        finalize(() => this.sessionsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (sessions) => this.sessions.set(sessions),
        error: (error: unknown) => this.sessionsProblem.set(this.handleProblem(error)),
      });
  }

  /** Opens a past session, or a new empty chat for `null`. */
  openSession(sessionId: string | null): void {
    // A session started by `send` is already active; navigating to it must not reload or clear it.
    if (sessionId === this.activeSessionId()) {
      return;
    }
    this.resetSession(sessionId);
    if (sessionId === null) {
      return;
    }
    this.sessionLoading.set(true);
    this.sessionSubscription = this.chatApi
      .getSession(sessionId)
      .pipe(finalize(() => this.sessionLoading.set(false)))
      .subscribe({
        next: (session) => this.messages.set(session.messages),
        error: (error: unknown) => this.sessionProblem.set(this.handleProblem(error)),
      });
  }

  /**
   * Asks a question in the open session, starting a session first when none is open. Emits the session id on
   * success; failures are kept in `failedQuestion` (the stream then completes without a value).
   */
  send(text: string): Observable<string> {
    const question = text.trim();
    if (!question || this.pendingQuestion() !== null) {
      return EMPTY;
    }
    this.pendingQuestion.set(question);
    this.failedQuestion.set(null);
    const current = this.activeSessionId();
    const sessionId$ = current
      ? of(current)
      : this.chatApi.createSession(this.connectionId).pipe(
          tap((session) => this.activeSessionId.set(session.id)),
          map((session) => session.id),
        );
    return sessionId$.pipe(
      switchMap((sessionId) =>
        this.chatApi.sendMessage(sessionId, question).pipe(
          tap((turn) =>
            this.messages.update((messages) => [...messages, turn.question, turn.answer]),
          ),
          map(() => sessionId),
        ),
      ),
      tap(() => this.loadSessions()),
      catchError((error: unknown) => {
        this.failedQuestion.set({ text: question, problem: this.handleProblem(error) });
        if (!current && this.activeSessionId()) {
          // The session was created before the question failed; list it so it can be reopened.
          this.loadSessions();
        }
        return EMPTY;
      }),
      finalize(() => this.pendingQuestion.set(null)),
      takeUntilDestroyed(this.destroyRef),
    );
  }

  /** Runs an answer's SELECT for one page. Only ever called from an explicit user action. */
  run(message: ChatMessage, pageNumber = 1): void {
    const sql = message.generatedSql;
    if (!sql || sql.kind !== 'query' || !sql.sql) {
      return;
    }
    const previous = this.executions().get(message.id);
    this.runSubscriptions.get(message.id)?.unsubscribe();
    this.setExecution(message.id, {
      status: 'running',
      pageNumber,
      result:
        previous?.status === 'success'
          ? previous.result
          : previous?.status === 'running'
            ? previous.result
            : undefined,
    });
    const subscription = this.executionsApi
      .execute(this.connectionId, sql.sql, pageNumber)
      .subscribe({
        next: (result) =>
          this.setExecution(message.id, {
            status: 'success',
            result: toResultPage(result),
            raw: result,
          }),
        error: (error: unknown) =>
          this.setExecution(message.id, {
            status: 'failure',
            pageNumber,
            problem: this.handleProblem(error),
          }),
      });
    this.runSubscriptions.set(message.id, subscription);
  }

  /**
   * Asks core for a table, KPI or chart for an answer whose query ran: only the result's column definitions are
   * sent, never rows. The preview renders with the rows of the current page.
   */
  visualize(message: ChatMessage, intent: VisualizationIntent): void {
    const execution = this.executions().get(message.id);
    const sessionId = this.activeSessionId();
    const sql = message.generatedSql?.sql;
    if (execution?.status !== 'success' || !sessionId || !sql) {
      return;
    }
    this.saves.update((current) => {
      const next = new Map(current);
      next.delete(message.id);
      return next;
    });
    this.setVisualization(message.id, { status: 'pending', intent });
    this.chatApi
      .createVisualization(sessionId, execution.raw.columns, intent)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (visualization) =>
          this.setVisualization(message.id, {
            status: 'ready',
            intent,
            visualization,
            renderer: toRendererArtifact(visualization.dsl, sql, visualization.columns),
          }),
        error: (error: unknown) =>
          this.setVisualization(message.id, {
            status: 'failure',
            intent,
            problem: this.handleProblem(error),
          }),
      });
  }

  /**
   * Saves a ready visualization with the answer's SELECT as an artifact of this connection. The artifact kind is
   * the requested kind; core checks that it matches the DSL (ADR-0010).
   */
  saveArtifact(message: ChatMessage, name: string): void {
    const state = this.visualizations().get(message.id);
    const sql = message.generatedSql?.sql;
    if (state?.status !== 'ready' || !sql) {
      return;
    }
    this.setSave(message.id, { status: 'saving' });
    this.artifactsApi
      .create(this.connectionId, {
        name,
        kind: state.intent.kind,
        dsl: state.visualization.dsl,
        sql,
        columns: state.visualization.columns,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (artifact) => this.setSave(message.id, { status: 'saved', artifact }),
        error: (error: unknown) =>
          this.setSave(message.id, { status: 'failure', problem: this.handleProblem(error) }),
      });
  }

  private setVisualization(messageId: string, state: VisualizationState): void {
    this.visualizations.update((current) => new Map(current).set(messageId, state));
  }

  private setSave(messageId: string, state: SaveState): void {
    this.saves.update((current) => new Map(current).set(messageId, state));
  }

  private setExecution(messageId: string, state: ExecutionState): void {
    this.executions.update((current) => new Map(current).set(messageId, state));
  }

  private resetSession(sessionId: string | null): void {
    this.sessionSubscription?.unsubscribe();
    this.sessionSubscription = null;
    for (const subscription of this.runSubscriptions.values()) subscription.unsubscribe();
    this.runSubscriptions.clear();
    this.activeSessionId.set(sessionId);
    this.messages.set([]);
    this.sessionProblem.set(null);
    this.failedQuestion.set(null);
    this.executions.set(new Map());
    this.visualizations.set(new Map());
    this.saves.set(new Map());
  }

  private cancelAll(): void {
    this.resetSession(null);
  }

  /** Reads an error and reacts to consent problems: a withdrawn connection is locked at once. */
  private handleProblem(error: unknown): ApiProblem {
    const problem = toApiProblem(error);
    if (isConsentWithdrawn(problem)) {
      this.connections.markWithdrawn(this.connectionId);
    } else if (needsTermsAcceptance(problem)) {
      this.consent.invalidate();
    }
    return problem;
  }
}
