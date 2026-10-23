import { mockSchemaMetadata } from '../../../../testing/mocks/core-api.mocks';
import type { SchemaMetadata } from '../../../core/api';
import { ERD_NODE_WIDTH, layoutErd, neighbours, subsetModel, toErdModel } from './erd-layout';

describe('erd-layout', () => {
  it('flattens tables, views, keys and relations', () => {
    const model = toErdModel(mockSchemaMetadata());

    expect(model.tables.map((t) => t.id)).toEqual([
      'dbo.Customers',
      'dbo.Orders',
      'dbo.vw_CustomerRevenue',
    ]);
    expect(model.schemaCount).toBe(1);
    expect(model.procedureCount).toBe(1);
    expect(model.relations).toEqual([
      {
        name: 'FK_Orders_Customers',
        from: 'dbo.Orders',
        fromColumns: ['CustomerId'],
        to: 'dbo.Customers',
        toColumns: ['CustomerId'],
      },
    ]);
    const orders = model.tables[1];
    expect(orders.columns.find((c) => c.name === 'OrderId')?.primaryKey).toBe(true);
    expect(orders.columns.find((c) => c.name === 'CustomerId')?.foreignKey).toBe(true);
    expect(model.tables[2].kind).toBe('view');
  });

  it('drops relations to tables that were not read', () => {
    const metadata: SchemaMetadata = {
      schemas: [
        {
          name: 'dbo',
          procedures: [],
          tables: [
            {
              name: 'A',
              kind: 'table',
              columns: [{ name: 'BId', sqlType: 'int', nullable: false }],
              foreignKeys: [
                {
                  name: 'FK_A_B',
                  columns: ['BId'],
                  referencedSchema: 'other',
                  referencedTable: 'B',
                  referencedColumns: ['Id'],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(toErdModel(metadata).relations).toEqual([]);
  });

  it('places a referenced table left of the table that references it, and unrelated tables after them', () => {
    const layout = layoutErd(toErdModel(mockSchemaMetadata()));
    const x = (id: string) => layout.nodes.find((n) => n.table.id === id)!.x;

    expect(x('dbo.Customers')).toBeLessThan(x('dbo.Orders'));
    expect(x('dbo.Orders')).toBeLessThan(x('dbo.vw_CustomerRevenue'));
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0].path).toMatch(/^M /);
    expect(layout.width).toBeGreaterThanOrEqual(3 * ERD_NODE_WIDTH);
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a === b) continue;
        const overlap =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
  });

  it('survives cycles and self-references', () => {
    const fk = (name: string, table: string) => ({
      name,
      columns: ['Ref'],
      referencedSchema: 'dbo',
      referencedTable: table,
      referencedColumns: ['Id'],
    });
    const table = (name: string, refs: ReturnType<typeof fk>[]) => ({
      name,
      kind: 'table' as const,
      columns: [
        { name: 'Id', sqlType: 'int', nullable: false },
        { name: 'Ref', sqlType: 'int', nullable: true },
      ],
      foreignKeys: refs,
    });
    const model = toErdModel({
      schemas: [
        {
          name: 'dbo',
          procedures: [],
          tables: [
            table('A', [fk('FK_A_B', 'B')]),
            table('B', [fk('FK_B_A', 'A')]),
            table('Tree', [fk('FK_Tree_Parent', 'Tree')]),
          ],
        },
      ],
    });
    const layout = layoutErd(model);
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(3);
  });

  it('finds neighbours and keeps only relations inside a subset', () => {
    const model = toErdModel(mockSchemaMetadata());
    expect([...neighbours(model, 'dbo.Customers')].sort()).toEqual(['dbo.Customers', 'dbo.Orders']);

    const subset = subsetModel(model, new Set(['dbo.Orders', 'dbo.vw_CustomerRevenue']));
    expect(subset.tables.map((t) => t.id)).toEqual(['dbo.Orders', 'dbo.vw_CustomerRevenue']);
    expect(subset.relations).toEqual([]);
  });

  it('lays out an empty database', () => {
    expect(layoutErd(toErdModel({ schemas: [] }))).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    });
  });
});
