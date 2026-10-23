---
id: feature-schema-discovery
type: feature
status: Implemented (core, portal)
updated: 2026-10-22
projects: [core, agents, contracts, portal]
issues: [ESI-16, ESI-17, ESI-18]
keywords: [schema, metadata, erd, diagram, tables, views, columns, primary key, foreign key, stored procedure definitions, SR-1]
---

# Schema discovery

The assistant reads the structure of a connected database so that generated SQL is grounded in real tables and columns. Requirement: SR-1 in [UR-1](../requirements/UR-1-bi-ai-assistant-web-application.md).

## What is read

| Item | Content |
|------|---------|
| Schemas | Every schema with user objects |
| Tables and views | Name and `kind` (`table` or `view`) |
| Columns | Name, SQL type with length or precision (for example `nvarchar(200)`, `decimal(18,2)`, `datetime2(7)`), nullability |
| Primary keys | Column names in key order |
| Foreign keys | Name, columns, referenced schema, table and columns |
| Stored procedures | Name and definition text (`OBJECT_DEFINITION`) as context only |

Objects shipped by Microsoft are excluded. No row values are read.

## API (core-api 0.2.0)

`GET /connections/{connectionId}/schema` (`getConnectionSchema`) returns `SchemaMetadata`. It needs an owned connection with granted consent and the current terms accepted (404, 403 otherwise).

## Diagrams

### Sequence: read schema metadata

```mermaid
sequenceDiagram
  participant Caller as Portal or ChatService (core)
  participant C as core-backend
  participant DB as App database (esi_core)
  participant S as User's SQL Server
  Caller->>C: GET /connections/{id}/schema (or internal call during chat)
  C->>DB: Load connection (owner, consent)
  C->>C: Check current terms, decrypt connection string
  C->>S: Open (ApplicationIntent=ReadOnly), BEGIN TRANSACTION
  C->>S: Catalog views: columns, primary keys, foreign keys
  C->>S: sys.procedures + OBJECT_DEFINITION (text only)
  S-->>C: Rows of the catalog views
  C->>S: ROLLBACK
  C-->>Caller: SchemaMetadata (schemas, tables/views, columns, keys, procedure definitions)
```

## How it is used

- **Chat:** for every question, core reads the schema and sends its structure, with procedure definitions, to the agent (`generateSql`). The agent grounds identifiers in it and masks string literals of procedure definitions in its prompt.
- **Users:** the connection workspace has a **Schema** tab (the last tab, `?tab=schema`) that shows the database as an entity-relationship diagram. It is a feature of its own, separate from chat: the schema is read only when the tab opens (and on "Refresh"), never pushed through chat answers.
  - Summary line: number of tables, views, relationships, schemas and stored procedures.
  - Diagram (`components/erd-diagram`): tables and views (views dashed) with columns, types and PK/FK marks; one arrow per foreign key from the referencing column to the referenced one. Layered layout in `helpers/erd-layout.ts` (a referenced table stands left of the tables that reference it; unrelated tables follow in a grid; cycles and self-references are drawn as loops). Pan by dragging or scrolling, zoom with the buttons or Ctrl/⌘ + wheel, "Fit" to the window.
  - Table list with search: the same content as text (accessible alternative to the SVG). Selecting a table, in the list or the diagram, shows its columns, "References" and "Referenced by", highlights its relations and can limit the diagram to it and its neighbours.
  - No new dependency: the layout is computed in the portal. No row values are read.

## Rules and guarantees

- Read inside a transaction that is always rolled back, with `ApplicationIntent=ReadOnly` and the command timeout of [query execution](./query-execution.md).
- Stored procedures are never executed; their definitions are text.
- Views are listed (so the assistant can explain them), but executed SELECTs may read only user tables (see [query execution](./query-execution.md)).

## Verification

core integration tests on the sample `esi_target` database: tables and the view with their kind, composite primary key, foreign keys, column types, procedure definition present, and no row values in the response.
