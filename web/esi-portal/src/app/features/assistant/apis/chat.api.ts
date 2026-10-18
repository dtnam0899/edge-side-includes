import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  ChatSession,
  ChatSessionSummary,
  ChatTurn,
  ColumnDefinition,
  CoreApi,
  Visualization,
  VisualizationIntent,
  createChatSessionRequest,
  createVisualizationRequest,
  getChatSessionRequest,
  listChatSessionsRequest,
  sendChatMessageRequest,
} from '../../../core/api';

/** HTTP boundary for chat sessions and messages of a connection. Sending a message never executes SQL. */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly api = inject(CoreApi);

  listSessions(connectionId: string): Observable<ChatSessionSummary[]> {
    return this.api.send((target) =>
      listChatSessionsRequest({ ...target, path: { connectionId } }),
    );
  }

  createSession(connectionId: string): Observable<ChatSession> {
    return this.api.send((target) =>
      createChatSessionRequest({ ...target, path: { connectionId }, body: {} }),
    );
  }

  getSession(sessionId: string): Observable<ChatSession> {
    return this.api.send((target) => getChatSessionRequest({ ...target, path: { sessionId } }));
  }

  sendMessage(sessionId: string, text: string): Observable<ChatTurn> {
    return this.api.send((target) =>
      sendChatMessageRequest({ ...target, path: { sessionId }, body: { text } }),
    );
  }

  /** Asks for a validated DSL document for the result columns (never rows). */
  createVisualization(
    sessionId: string,
    columns: readonly ColumnDefinition[],
    intent: VisualizationIntent,
  ): Observable<Visualization> {
    return this.api.send((target) =>
      createVisualizationRequest({
        ...target,
        path: { sessionId },
        body: { columns: [...columns], intent },
      }),
    );
  }
}
