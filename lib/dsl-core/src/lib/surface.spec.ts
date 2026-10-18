import { A2UI_PINS, BASIC_CATALOG_ID } from '@dtnam0899/dsl-schema';
import { INVALID_FIXTURES, RENDER_FIXTURES, VALID_FIXTURES } from '@dtnam0899/dsl-schema/fixtures';
import { validateServerMessage } from './schema-validator';
import { deleteSurfaceMessage, planSurface } from './surface';

describe('planSurface', () => {
  it('builds createSurface, updateComponents and updateDataModel for the table fixture', () => {
    const { artifact, result } = VALID_FIXTURES['table'];
    const plan = planSurface(artifact, result, 'item-1');
    if (plan.status !== 'ready') throw new Error(`expected ready, got ${plan.status}`);

    expect(plan.messages.map((message) => Object.keys(message).find((key) => key !== 'version'))).toEqual([
      'createSurface',
      'updateComponents',
      'updateDataModel',
    ]);
    expect(plan.messages[0]).toEqual({ version: A2UI_PINS.protocolVersion, createSurface: { surfaceId: 'item-1', catalogId: BASIC_CATALOG_ID } });
    expect(plan.messages[1]).toMatchObject({ updateComponents: { surfaceId: 'item-1', components: (artifact as { components: unknown }).components } });
    expect(plan.messages[2]).toEqual({
      version: A2UI_PINS.protocolVersion,
      updateDataModel: { surfaceId: 'item-1', path: '/', value: { rows: result.rows, page: result.page } },
    });
  });

  it.each(Object.keys(VALID_FIXTURES))('emits messages that pass the A2UI v0.9.1 schema (%s)', (name) => {
    const { artifact, result } = VALID_FIXTURES[name];
    const plan = planSurface(artifact, result, `surface-${name}`);
    if (plan.status !== 'ready') throw new Error(`expected ready, got ${plan.status}`);
    for (const message of [...plan.messages, deleteSurfaceMessage(`surface-${name}`)]) {
      expect(validateServerMessage(message)).toEqual([]);
    }
  });

  it('does not share component objects with the stored artifact', () => {
    const { artifact, result } = VALID_FIXTURES['kpi'];
    const plan = planSurface(artifact, result, 's');
    if (plan.status !== 'ready') throw new Error('expected ready');
    expect(plan.messages[1]).not.toHaveProperty('updateComponents.components', undefined);
    const sent = (plan.messages[1] as { updateComponents: { components: unknown[] } }).updateComponents.components;
    expect(sent[0]).not.toBe((artifact as { components: unknown[] }).components[0]);
  });

  it('rejects an invalid artifact before building any message', () => {
    const plan = planSurface(INVALID_FIXTURES['html-content'].artifact, VALID_FIXTURES['kpi'].result, 's');
    expect(plan).toMatchObject({ status: 'invalid', errors: [{ code: 'unsafe-content' }] });
  });

  it('reports a bound column that is missing from the live result', () => {
    const { artifact, result, expectedMissingColumns } = RENDER_FIXTURES['missing-column'];
    expect(planSurface(artifact, result, 's')).toEqual({ status: 'missing-columns', missingColumns: expectedMissingColumns });
  });

  it('keeps only declared columns and turns non-primitive cells into text', () => {
    const { artifact, result } = VALID_FIXTURES['table'];
    const rows = [{ region: { path: '/page' }, revenue: 1, secret: 'x' }, { region: new Date(0), revenue: Number.NaN }];
    const plan = planSurface(artifact, { ...result, rows }, 's');
    if (plan.status !== 'ready') throw new Error('expected ready');
    expect((plan.messages[2] as { updateDataModel: { value: { rows: unknown } } }).updateDataModel.value.rows).toEqual([
      { region: '{"path":"/page"}', revenue: 1 },
      { region: '1970-01-01T00:00:00.000Z', revenue: 'NaN' },
    ]);
  });
});
