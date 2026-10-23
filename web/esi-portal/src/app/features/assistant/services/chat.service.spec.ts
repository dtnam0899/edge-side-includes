import { TestBed } from '@angular/core/testing';

import {
  httpTesting,
  problemResponse,
  provideCoreApiTesting,
} from '../../../../testing/core-api-testing';
import {
  MOCK_ID,
  MOCK_ID_2,
  mockAnswer,
  mockArtifact,
  mockChartVisualization,
  mockChatSession,
  mockChatSessionSummary,
  mockChatTurn,
  mockConnection,
  mockFullQueryPage,
  mockGeneratedSql,
  mockKpiResult,
  mockProblem,
  mockVisualization,
  MOCK_KPI_COLUMNS,
} from '../../../../testing/mocks/core-api.mocks';
import { ChatService } from './chat.service';
import { ConnectionsService } from './connections.service';
import { ConsentService } from './consent.service';

describe('ChatService', () => {
  let chat: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatService, ConnectionsService, ConsentService, ...provideCoreApiTesting()],
    });
    chat = TestBed.inject(ChatService);
    chat.setConnection(MOCK_ID);
    httpTesting()
      .expectOne(`/api/connections/${MOCK_ID}/chat-sessions`)
      .flush([mockChatSessionSummary()]);
  });

  afterEach(() => httpTesting().verify());

  it('lists the connection sessions', () => {
    expect(chat.sessions()).toEqual([mockChatSessionSummary()]);
  });

  it('opens a past session without executing any SQL', () => {
    chat.openSession(MOCK_ID_2);
    httpTesting().expectOne(`/api/chat-sessions/${MOCK_ID_2}`).flush(mockChatSession());

    expect(chat.messages()).toHaveLength(2);
    expect(chat.executions().size).toBe(0);
    httpTesting().expectNone((request) => request.url.endsWith('/executions'));
  });

  it('starts a session for the first question and shows progress until the answer arrives', () => {
    let sessionId: string | undefined;
    chat.send('  Total revenue per customer in 2026 ').subscribe((id) => (sessionId = id));

    expect(chat.pendingQuestion()).toBe('Total revenue per customer in 2026');
    httpTesting()
      .expectOne({ method: 'POST', url: `/api/connections/${MOCK_ID}/chat-sessions` })
      .flush(mockChatSession({ messages: [] }));
    const message = httpTesting().expectOne({
      method: 'POST',
      url: `/api/chat-sessions/${MOCK_ID_2}/messages`,
    });
    expect(message.request.body).toEqual({ text: 'Total revenue per customer in 2026' });
    message.flush(mockChatTurn());
    httpTesting()
      .expectOne(`/api/connections/${MOCK_ID}/chat-sessions`)
      .flush([mockChatSessionSummary()]);

    expect(sessionId).toBe(MOCK_ID_2);
    expect(chat.pendingQuestion()).toBeNull();
    expect(chat.messages().map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(chat.executions().size).toBe(0);
  });

  it('keeps a failed question with its problem instead of an answer', () => {
    chat.openSession(MOCK_ID_2);
    httpTesting()
      .expectOne(`/api/chat-sessions/${MOCK_ID_2}`)
      .flush(mockChatSession({ messages: [] }));

    chat.send('Total revenue').subscribe();
    httpTesting()
      .expectOne(`/api/chat-sessions/${MOCK_ID_2}/messages`)
      .flush({ type: 'about:blank', title: 'Unavailable', status: 503 }, problemResponse(503));

    expect(chat.pendingQuestion()).toBeNull();
    expect(chat.messages()).toEqual([]);
    expect(chat.failedQuestion()?.text).toBe('Total revenue');
    expect(chat.failedQuestion()?.problem.status).toBe(503);
  });

  it('runs a query page only when asked and maps the result', () => {
    const answer = mockAnswer();
    chat.run(answer, 2);

    expect(chat.executions().get(answer.id)?.status).toBe('running');
    const request = httpTesting().expectOne({
      method: 'POST',
      url: `/api/connections/${MOCK_ID}/executions`,
    });
    expect(request.request.body).toEqual({ sql: mockGeneratedSql().sql, page: 2 });
    request.flush(mockFullQueryPage(2, 3));

    const state = chat.executions().get(answer.id);
    expect(state?.status).toBe('success');
    expect(state?.status === 'success' && state.result.firstRow).toBe(21);
  });

  it('reports a failed execution as a failure, never as an empty result', () => {
    const answer = mockAnswer();
    chat.run(answer);
    httpTesting()
      .expectOne(`/api/connections/${MOCK_ID}/executions`)
      .flush(
        mockProblem('execution-failed', 422, { detail: "Invalid column name 'Nope'." }),
        problemResponse(422),
      );

    const state = chat.executions().get(answer.id);
    expect(state?.status).toBe('failure');
    expect(state && 'result' in state).toBe(false);
  });

  it('never executes a stored-procedure script', () => {
    chat.run(
      mockAnswer({
        generatedSql: mockGeneratedSql({
          kind: 'stored-procedure',
          sql: 'CREATE PROCEDURE p AS SELECT 1',
        }),
      }),
    );
    httpTesting().expectNone((request) => request.url.endsWith('/executions'));
  });

  it('locks the connection when the server says consent was withdrawn', () => {
    const connections = TestBed.inject(ConnectionsService);
    connections.connections.set([mockConnection()]);

    chat.loadSessions();
    httpTesting()
      .expectOne(`/api/connections/${MOCK_ID}/chat-sessions`)
      .flush(mockProblem('consent-withdrawn', 403), problemResponse(403));

    expect(connections.find(MOCK_ID)?.consent).toBe('withdrawn');
    expect(chat.sessionsProblem()?.name).toBe('consent-withdrawn');
  });

  describe('visualizations', () => {
    function ranAnswer() {
      chat.openSession(MOCK_ID_2);
      httpTesting().expectOne(`/api/chat-sessions/${MOCK_ID_2}`).flush(mockChatSession());
      const answer = chat.messages()[1];
      chat.run(answer);
      httpTesting().expectOne(`/api/connections/${MOCK_ID}/executions`).flush(mockKpiResult());
      return answer;
    }

    it('sends only the result columns and the intent, then keeps the ready preview', () => {
      const answer = ranAnswer();
      chat.visualize(answer, { kind: 'kpi', description: 'total revenue' });
      expect(chat.visualizations().get(answer.id)?.status).toBe('pending');

      const request = httpTesting().expectOne({
        method: 'POST',
        url: `/api/chat-sessions/${MOCK_ID_2}/visualizations`,
      });
      expect(request.request.body).toEqual({
        columns: MOCK_KPI_COLUMNS,
        intent: { kind: 'kpi', description: 'total revenue' },
      });
      expect(JSON.stringify(request.request.body)).not.toContain('156.5');
      request.flush(mockVisualization());

      const state = chat.visualizations().get(answer.id);
      expect(state?.status).toBe('ready');
      expect(state?.status === 'ready' && state.renderer.status).toBe('ready');
    });

    it('keeps a refusal as a failure with its problem', () => {
      const answer = ranAnswer();
      chat.visualize(answer, { kind: 'table', description: 'as a pie chart' });
      httpTesting()
        .expectOne(`/api/chat-sessions/${MOCK_ID_2}/visualizations`)
        .flush(mockProblem('visualization-not-supported', 422), problemResponse(422));
      const state = chat.visualizations().get(answer.id);
      expect(state?.status === 'failure' && state.problem.name).toBe('visualization-not-supported');
    });

    it('does nothing before the query ran', () => {
      chat.openSession(MOCK_ID_2);
      httpTesting().expectOne(`/api/chat-sessions/${MOCK_ID_2}`).flush(mockChatSession());
      chat.visualize(chat.messages()[1], { kind: 'table' });
      httpTesting().expectNone((r) => r.url.endsWith('/visualizations'));
    });

    it('saves a ready visualization with the answer SELECT as an artifact', () => {
      const answer = ranAnswer();
      chat.visualize(answer, { kind: 'kpi' });
      httpTesting()
        .expectOne(`/api/chat-sessions/${MOCK_ID_2}/visualizations`)
        .flush(mockVisualization());

      chat.saveArtifact(answer, 'Total revenue');
      const save = httpTesting().expectOne({
        method: 'POST',
        url: `/api/connections/${MOCK_ID}/artifacts`,
      });
      expect(save.request.body).toEqual({
        name: 'Total revenue',
        kind: 'kpi',
        dsl: mockVisualization().dsl,
        sql: mockGeneratedSql().sql,
        columns: MOCK_KPI_COLUMNS,
      });
      save.flush({
        ...mockVisualization(),
        id: MOCK_ID_2,
        connectionId: MOCK_ID,
        name: 'Total revenue',
        kind: 'kpi',
        status: 'available',
        createdAt: '2026-10-18T09:30:00Z',
        sql: mockGeneratedSql().sql,
      });
      expect(chat.saves().get(answer.id)?.status).toBe('saved');
    });

    it('asks for a chart, renders it on the ESI catalog and saves it as a chart', () => {
      const answer = ranAnswer();
      chat.visualize(answer, { kind: 'chart', description: 'revenue per customer' });
      const request = httpTesting().expectOne(`/api/chat-sessions/${MOCK_ID_2}/visualizations`);
      expect(request.request.body.intent).toEqual({
        kind: 'chart',
        description: 'revenue per customer',
      });
      request.flush(mockChartVisualization());

      const state = chat.visualizations().get(answer.id);
      expect(state?.status === 'ready' && state.renderer.status).toBe('ready');

      chat.saveArtifact(answer, 'Revenue per customer');
      const save = httpTesting().expectOne({
        method: 'POST',
        url: `/api/connections/${MOCK_ID}/artifacts`,
      });
      expect(save.request.body).toEqual({
        name: 'Revenue per customer',
        kind: 'chart',
        dsl: mockChartVisualization().dsl,
        sql: mockGeneratedSql().sql,
        columns: mockChartVisualization().columns,
      });
      save.flush(
        mockArtifact({
          name: 'Revenue per customer',
          kind: 'chart',
          dsl: mockChartVisualization().dsl,
          columns: mockChartVisualization().columns,
        }),
      );
      expect(chat.saves().get(answer.id)?.status).toBe('saved');
    });
  });
});
