/**
 * Mocked core-api responses for unit tests (P0-14, docs/process/test-data.md).
 *
 * Source: the field `example`s of the pinned contract `@dtnam0899/esi-contracts` 0.1.0 (`bundled/core-api.yaml`),
 * the version in `package.json` `esi.coreApiContract` and `CORE_API_CONTRACT_VERSION`. Fields without an example
 * in the contract use neutral stand-ins from the same customers/products/orders domain (marked "no contract
 * example"). Typed with the generated client, so a contract
 * bump that changes a shape fails to compile here; regenerate this file in the same PR as the bump.
 * No real data, credentials or connection strings with real passwords.
 */
import type {
  Artifact,
  ArtifactSummary,
  ChatMessage,
  ColumnDefinition,
  Dashboard,
  DashboardItem,
  DslDocument,
  Visualization,
  ChatSession,
  ChatSessionSummary,
  ChatTurn,
  Connection,
  ConnectionTestResult,
  ConsentAcceptance,
  ConsentTerms,
  GeneratedSql,
  Problem,
  QueryResult,
  SchemaMetadata,
  Script,
} from '../../app/core/api';

/** The contract version these mocks follow: the one the committed client was generated from. */
export { CORE_API_CONTRACT_VERSION } from '../../app/core/api/generated/contract-version.gen';

/** `Id` example. */
export const MOCK_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
/** Further ids (no contract example). */
export const MOCK_ID_2 = '3f2504e0-4f89-41d3-9a0c-0305e82c3302';
export const MOCK_ID_3 = '3f2504e0-4f89-41d3-9a0c-0305e82c3303';
export const MOCK_ID_4 = '3f2504e0-4f89-41d3-9a0c-0305e82c3304';

/** Date-times have no contract example. */
const AT = '2026-10-18T09:30:00Z';

export function mockConsentTerms(overrides: Partial<ConsentTerms> = {}): ConsentTerms {
  return {
    version: '2026-10-18.1',
    // no contract example: short Markdown in the shape of the draft terms
    text: '# Data access terms (draft)\n\n> Draft, not yet approved.\n\n## 1. Your authority\nYou are authorized to connect.\n\n- Read only\n- Local databases',
    status: 'draft',
    publishedAt: AT,
    ...overrides,
  };
}

export function mockConsentAcceptance(
  overrides: Partial<ConsentAcceptance> = {},
): ConsentAcceptance {
  return { termsVersion: '2026-10-18.1', acceptedAt: AT, isCurrent: true, ...overrides };
}

export function mockConnection(overrides: Partial<Connection> = {}): Connection {
  return {
    id: MOCK_ID,
    name: 'Sales DB',
    server: 'sql01.example.local',
    database: 'Sales',
    consent: 'granted',
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

/** `CreateConnectionRequest.connectionString` example (masked password). Only ever sent, never returned. */
export const MOCK_CONNECTION_STRING =
  'Server=sql01.example.local;Database=Sales;User Id=reader;Password=***;Encrypt=True';

export function mockConnectionTestResult(): ConnectionTestResult {
  return { serverVersion: '17.0.1000.7', durationMs: 120 };
}

export function mockGeneratedSql(overrides: Partial<GeneratedSql> = {}): GeneratedSql {
  return {
    kind: 'query',
    sql: 'SELECT c.Name, SUM(l.Quantity * l.UnitPrice) AS Revenue FROM dbo.Customers AS c JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId JOIN dbo.OrderLines AS l ON l.OrderId = o.OrderId GROUP BY c.Name',
    referencedTables: ['dbo.Orders'],
    ...overrides,
  };
}

export function mockQuestion(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: MOCK_ID_3,
    role: 'user',
    text: 'Total revenue per customer in 2026',
    createdAt: AT,
    ...overrides,
  };
}

export function mockAnswer(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: MOCK_ID_4,
    role: 'assistant',
    // no contract example
    text: 'Sums order line revenue per customer, joining Customers, Orders and OrderLines.',
    createdAt: AT,
    generatedSql: mockGeneratedSql(),
    ...overrides,
  };
}

export function mockChatTurn(): ChatTurn {
  return { question: mockQuestion(), answer: mockAnswer() };
}

export function mockChatSessionSummary(
  overrides: Partial<ChatSessionSummary> = {},
): ChatSessionSummary {
  return {
    id: MOCK_ID_2,
    connectionId: MOCK_ID,
    title: 'Total revenue per customer in 2026',
    createdAt: AT,
    lastActivityAt: AT,
    ...overrides,
  };
}

export function mockChatSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return { ...mockChatSessionSummary(), messages: [mockQuestion(), mockAnswer()], ...overrides };
}

/** `QueryResult.rows` example, with `ColumnDefinition` examples for the column shape. */
export function mockQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    columns: [
      { name: 'Name', sqlType: 'nvarchar(200)', nullable: false },
      { name: 'Revenue', sqlType: 'decimal(18,2)', nullable: true },
    ],
    rows: [{ Name: 'Contoso Ltd', Revenue: 56.5 }],
    page: { number: 1, size: 20, remainingRows: 42 },
    truncatedCells: [],
    durationMs: 35,
    ...overrides,
  };
}

/** A full first page: 20 rows, 42 remaining. */
export function mockFullQueryPage(pageNumber = 1, remainingRows = 42): QueryResult {
  return mockQueryResult({
    rows: Array.from({ length: 20 }, (_, i) => ({
      Name: `Customer ${(pageNumber - 1) * 20 + i + 1}`,
      Revenue: i === 3 ? null : 10 + i,
    })),
    page: { number: pageNumber, size: 20, remainingRows },
  });
}

export function mockScript(overrides: Partial<Script> = {}): Script {
  return {
    id: MOCK_ID_2,
    connectionId: MOCK_ID,
    name: 'usp_RevenuePerCustomer',
    // no contract example
    sql: 'CREATE PROCEDURE dbo.usp_RevenuePerCustomer AS\nBEGIN\n  SELECT c.Name FROM dbo.Customers AS c;\nEND',
    sessionId: MOCK_ID_2,
    createdAt: AT,
    ...overrides,
  };
}

/** Problem body with the contract's `urn:esi:problem:<name>` type. */
export function mockProblem(
  name: string,
  status: number,
  overrides: Partial<Problem> = {},
): Problem {
  return { type: `urn:esi:problem:${name}`, title: name.replace(/-/g, ' '), status, ...overrides };
}

/**
 * DSL document in the shape core returns (`DslDocument`): the `catalogId` example; `protocolVersion` and
 * `dslSchemaVersion` as core validates them ("v0.9" and the dsl-schema package version "0.1.0"; the contract's
 * field example "0.9.1" is not what core accepts). Components: a KPI over `Revenue`.
 */
export function mockDslDocument(overrides: Partial<DslDocument> = {}): DslDocument {
  return {
    catalogId: 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json',
    protocolVersion: 'v0.9',
    dslSchemaVersion: '0.1.0',
    components: [
      { id: 'root', component: 'Card', child: 'kpi-column' },
      { id: 'kpi-column', component: 'Column', children: ['kpi-label', 'kpi-value'] },
      { id: 'kpi-label', component: 'Text', text: 'Total revenue', variant: 'caption' },
      {
        id: 'kpi-value',
        component: 'Text',
        variant: 'h2',
        text: {
          call: 'formatNumber',
          args: { value: { path: '/rows/0/Revenue' } },
          returnType: 'string',
        },
      },
    ],
    ...overrides,
  };
}

export const MOCK_KPI_COLUMNS: ColumnDefinition[] = [
  { name: 'Revenue', sqlType: 'decimal(18,2)', nullable: true },
];
export const MOCK_KPI_SQL =
  'SELECT SUM(l.Quantity * l.UnitPrice) AS Revenue FROM dbo.OrderLines AS l';

export function mockKpiResult(): QueryResult {
  return mockQueryResult({
    columns: MOCK_KPI_COLUMNS,
    rows: [{ Revenue: 156.5 }],
    page: { number: 1, size: 20, remainingRows: 0 },
  });
}

export function mockVisualization(overrides: Partial<Visualization> = {}): Visualization {
  return { dsl: mockDslDocument(), columns: MOCK_KPI_COLUMNS, ...overrides };
}

export function mockArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: MOCK_ID_3,
    connectionId: MOCK_ID,
    name: 'Total revenue',
    kind: 'kpi',
    status: 'available',
    createdAt: AT,
    dsl: mockDslDocument(),
    sql: MOCK_KPI_SQL,
    columns: MOCK_KPI_COLUMNS,
    ...overrides,
  };
}

export function mockArtifactSummary(overrides: Partial<ArtifactSummary> = {}): ArtifactSummary {
  const { id, connectionId, name, kind, status, createdAt } = mockArtifact();
  return { id, connectionId, name, kind, status, createdAt, ...overrides };
}

export function mockDashboardItem(
  id: string,
  overrides: Partial<DashboardItem> = {},
): DashboardItem {
  return {
    id,
    artifactId: MOCK_ID_3,
    layout: { x: 0, y: 0, width: 3, height: 2 },
    status: 'available',
    artifact: mockArtifact(),
    ...overrides,
  };
}

export function mockDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    id: MOCK_ID_4,
    connectionId: MOCK_ID,
    name: 'Sales overview',
    items: [],
    updatedAt: AT,
    ...overrides,
  };
}

/**
 * Schema metadata (`SchemaMetadata`): the `dbo`, `Orders`, `FK_Orders_Customers` and `usp_GetCustomerOrders`
 * examples; the other tables, columns and the view have no contract example.
 */
export function mockSchemaMetadata(overrides: Partial<SchemaMetadata> = {}): SchemaMetadata {
  return {
    schemas: [
      {
        name: 'dbo',
        tables: [
          {
            name: 'Customers',
            kind: 'table',
            columns: [
              { name: 'CustomerId', sqlType: 'int', nullable: false },
              { name: 'Name', sqlType: 'nvarchar(200)', nullable: false },
            ],
            primaryKey: ['CustomerId'],
          },
          {
            name: 'Orders',
            kind: 'table',
            columns: [
              { name: 'OrderId', sqlType: 'int', nullable: false },
              { name: 'CustomerId', sqlType: 'int', nullable: false },
              { name: 'Total', sqlType: 'decimal(18,2)', nullable: true },
            ],
            primaryKey: ['OrderId'],
            foreignKeys: [
              {
                name: 'FK_Orders_Customers',
                columns: ['CustomerId'],
                referencedSchema: 'dbo',
                referencedTable: 'Customers',
                referencedColumns: ['CustomerId'],
              },
            ],
          },
          {
            name: 'vw_CustomerRevenue',
            kind: 'view',
            columns: [
              { name: 'Name', sqlType: 'nvarchar(200)', nullable: false },
              { name: 'Revenue', sqlType: 'decimal(18,2)', nullable: true },
            ],
          },
        ],
        procedures: [
          {
            name: 'usp_GetCustomerOrders',
            definition: 'CREATE PROCEDURE dbo.usp_GetCustomerOrders AS SELECT 1;',
          },
        ],
      },
    ],
    ...overrides,
  };
}
