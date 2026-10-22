import type { SchemaMetadata, TableMetadata } from '../../../core/api';

/** Size of a table box in the diagram (SVG user units). */
export const ERD_NODE_WIDTH = 240;
export const ERD_HEADER_HEIGHT = 32;
export const ERD_ROW_HEIGHT = 22;
const ERD_PADDING_BOTTOM = 6;
const ERD_GAP_X = 120;
const ERD_GAP_Y = 32;
const ERD_MARGIN = 24;

export interface ErdColumn {
  readonly name: string;
  readonly sqlType: string;
  readonly nullable: boolean;
  readonly primaryKey: boolean;
  readonly foreignKey: boolean;
}

export interface ErdTable {
  /** `schema.table`, unique in a database. */
  readonly id: string;
  readonly schema: string;
  readonly name: string;
  readonly kind: TableMetadata['kind'];
  readonly columns: readonly ErdColumn[];
}

export interface ErdRelation {
  /** Foreign key name; unique together with `from`. */
  readonly name: string;
  /** The table holding the foreign key. */
  readonly from: string;
  readonly fromColumns: readonly string[];
  /** The referenced table. */
  readonly to: string;
  readonly toColumns: readonly string[];
}

export interface ErdModel {
  readonly tables: readonly ErdTable[];
  readonly relations: readonly ErdRelation[];
  readonly schemaCount: number;
  readonly procedureCount: number;
}

export interface ErdNode {
  readonly table: ErdTable;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ErdEdge {
  readonly relation: ErdRelation;
  /** SVG path data from the foreign key column to the referenced column. */
  readonly path: string;
}

export interface ErdLayout {
  readonly nodes: readonly ErdNode[];
  readonly edges: readonly ErdEdge[];
  readonly width: number;
  readonly height: number;
}

export function tableId(schema: string, table: string): string {
  return `${schema}.${table}`;
}

/** Flattens the schema metadata into tables and foreign key relations, sorted by id. */
export function toErdModel(metadata: SchemaMetadata): ErdModel {
  const tables: ErdTable[] = [];
  const relations: ErdRelation[] = [];
  let procedureCount = 0;
  for (const schema of metadata.schemas) {
    procedureCount += schema.procedures.length;
    for (const table of schema.tables) {
      const id = tableId(schema.name, table.name);
      const primaryKey = new Set(table.primaryKey ?? []);
      const foreignKey = new Set((table.foreignKeys ?? []).flatMap((fk) => fk.columns));
      tables.push({
        id,
        schema: schema.name,
        name: table.name,
        kind: table.kind,
        columns: table.columns.map((column) => ({
          name: column.name,
          sqlType: column.sqlType,
          nullable: column.nullable,
          primaryKey: primaryKey.has(column.name),
          foreignKey: foreignKey.has(column.name),
        })),
      });
      for (const fk of table.foreignKeys ?? []) {
        relations.push({
          name: fk.name,
          from: id,
          fromColumns: fk.columns,
          to: tableId(fk.referencedSchema, fk.referencedTable),
          toColumns: fk.referencedColumns,
        });
      }
    }
  }
  tables.sort((a, b) => a.id.localeCompare(b.id));
  const known = new Set(tables.map((t) => t.id));
  return {
    tables,
    // A foreign key into a table that was not read (another database, excluded object) has nothing to point at.
    relations: relations.filter((r) => known.has(r.to)),
    schemaCount: metadata.schemas.length,
    procedureCount,
  };
}

/** Tables directly related to `id` through a foreign key in either direction, `id` included. */
export function neighbours(model: ErdModel, id: string): ReadonlySet<string> {
  const related = new Set([id]);
  for (const relation of model.relations) {
    if (relation.from === id) related.add(relation.to);
    if (relation.to === id) related.add(relation.from);
  }
  return related;
}

/** Keeps only the given tables and the relations between them. */
export function subsetModel(model: ErdModel, ids: ReadonlySet<string>): ErdModel {
  return {
    ...model,
    tables: model.tables.filter((t) => ids.has(t.id)),
    relations: model.relations.filter((r) => ids.has(r.from) && ids.has(r.to)),
  };
}

function nodeHeight(table: ErdTable): number {
  return ERD_HEADER_HEIGHT + table.columns.length * ERD_ROW_HEIGHT + ERD_PADDING_BOTTOM;
}

/**
 * Layered layout: a referenced (parent) table stands in a column left of the tables that reference it, so foreign
 * keys point leftwards. Tables without any relation are placed in a grid after the related ones. Deterministic for
 * the same model.
 */
export function layoutErd(model: ErdModel): ErdLayout {
  const parents = new Map<string, Set<string>>();
  const related = new Set<string>();
  for (const relation of model.relations) {
    if (relation.from === relation.to) continue;
    related.add(relation.from).add(relation.to);
    const set = parents.get(relation.from) ?? new Set<string>();
    set.add(relation.to);
    parents.set(relation.from, set);
  }

  // Longest path from a table without parents; a cycle is cut where it is found.
  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const layerOf = (id: string): number => {
    const known = layer.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return -1;
    visiting.add(id);
    let value = 0;
    for (const parent of parents.get(id) ?? []) {
      value = Math.max(value, layerOf(parent) + 1);
    }
    visiting.delete(id);
    layer.set(id, value);
    return value;
  };

  const connected = model.tables.filter((t) => related.has(t.id));
  const isolated = model.tables.filter((t) => !related.has(t.id));
  const columns: ErdTable[][] = [];
  for (const table of connected) {
    const index = layerOf(table.id);
    (columns[index] ??= []).push(table);
  }

  // One barycenter pass: order each column by the mean position of its parents in earlier columns.
  const rank = new Map<string, number>();
  for (const column of columns) {
    if (!column) continue;
    const score = (t: ErdTable): number => {
      const ranks = [...(parents.get(t.id) ?? [])]
        .map((p) => rank.get(p))
        .filter((r): r is number => r !== undefined);
      return ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : Number.MAX_VALUE;
    };
    column.sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));
    column.forEach((t, i) => rank.set(t.id, i));
  }

  const perColumn = Math.max(4, Math.ceil(Math.sqrt(isolated.length)));
  const grid: ErdTable[][] = [];
  isolated.forEach((t, i) => (grid[Math.floor(i / perColumn)] ??= []).push(t));

  const nodes: ErdNode[] = [];
  let x = ERD_MARGIN;
  let height = 0;
  for (const column of [...columns.filter(Boolean), ...grid]) {
    let y = ERD_MARGIN;
    for (const table of column) {
      const h = nodeHeight(table);
      nodes.push({ table, x, y, width: ERD_NODE_WIDTH, height: h });
      y += h + ERD_GAP_Y;
    }
    height = Math.max(height, y - ERD_GAP_Y + ERD_MARGIN);
    x += ERD_NODE_WIDTH + ERD_GAP_X;
  }
  const width = nodes.length ? x - ERD_GAP_X + ERD_MARGIN : 0;

  const byId = new Map(nodes.map((n) => [n.table.id, n]));
  const edges = model.relations.flatMap((relation) => {
    const from = byId.get(relation.from);
    const to = byId.get(relation.to);
    return from && to
      ? [{ relation, path: edgePath(from, relation.fromColumns[0], to, relation.toColumns[0]) }]
      : [];
  });
  return { nodes, edges, width, height };
}

function rowY(node: ErdNode, column: string | undefined): number {
  const index = node.table.columns.findIndex((c) => c.name === column);
  return index < 0
    ? node.y + ERD_HEADER_HEIGHT / 2
    : node.y + ERD_HEADER_HEIGHT + index * ERD_ROW_HEIGHT + ERD_ROW_HEIGHT / 2;
}

function edgePath(
  from: ErdNode,
  fromColumn: string | undefined,
  to: ErdNode,
  toColumn: string | undefined,
): string {
  const y1 = rowY(from, fromColumn);
  const y2 = rowY(to, toColumn);
  if (from === to || from.x === to.x) {
    // Same column (self-reference or a cut cycle): loop out on the right side.
    const x1 = from.x + from.width;
    const bend = x1 + 48;
    return `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${x1} ${y2}`;
  }
  const leftwards = to.x < from.x;
  const x1 = leftwards ? from.x : from.x + from.width;
  const x2 = leftwards ? to.x + to.width : to.x;
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}
