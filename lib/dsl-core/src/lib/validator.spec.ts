import { BASIC_CATALOG_ID } from '@dtnam0899/dsl-schema';
import { INVALID_FIXTURES, VALID_FIXTURES } from '@dtnam0899/dsl-schema/fixtures';
import { validateArtifact } from './validator';

describe('validateArtifact', () => {
  describe.each(Object.entries(VALID_FIXTURES))('valid fixture %s', (_name, fixture) => {
    it('is accepted', () => {
      const result = validateArtifact(fixture.artifact);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });

  describe.each(Object.entries(INVALID_FIXTURES))('invalid fixture %s', (_name, fixture) => {
    it(`is rejected with ${fixture.expectedErrors.join(', ')}`, () => {
      const result = validateArtifact(fixture.artifact);
      expect(result.valid).toBe(false);
      expect(result.errors.map((error) => error.code)).toEqual(expect.arrayContaining(fixture.expectedErrors));
    });
  });

  it('reports the bound columns of a valid artifact', () => {
    const result = validateArtifact(VALID_FIXTURES['table'].artifact);
    expect(result.valid && [...result.boundColumns].sort()).toEqual(['region', 'revenue']);
  });

  it('points at the offending value and component', () => {
    const result = validateArtifact(INVALID_FIXTURES['unknown-column'].artifact);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'unknown-column', path: '/components/8/text/args/value/path', componentId: 'cell-revenue' }),
    );
  });

  it('reports an unknown component once, without the catalog oneOf noise', () => {
    const result = validateArtifact(INVALID_FIXTURES['unknown-component'].artifact);
    expect(result.errors).toEqual([expect.objectContaining({ code: 'unknown-component', componentId: 'grid' })]);
  });

  it('reports a property error of a known component against that component schema', () => {
    const result = validateArtifact(INVALID_FIXTURES['schema-property'].artifact);
    expect(result.errors).toEqual([expect.objectContaining({ code: 'schema', path: '/components/2/variant', componentId: 'kpi-label' })]);
  });

  it('rejects a value that is not an object', () => {
    for (const input of [null, 'root', 42, []]) {
      expect(validateArtifact(input)).toMatchObject({ valid: false, errors: [{ code: 'schema' }] });
    }
  });

  it('checks paths interpolated by formatString', () => {
    const artifact = structuredClone(VALID_FIXTURES['kpi'].artifact) as { components: Record<string, unknown>[] };
    artifact.components[2]['text'] = {
      call: 'formatString',
      args: { value: 'Total ${/rows/0/total_revenue} of ${/rows/0/profit}, ${formatDate(value: 1)}' },
      returnType: 'string',
    };
    const codes = validateArtifact(artifact).errors.map((error) => error.code);
    expect(codes.sort()).toEqual(['unknown-column', 'unsupported-expression']);
  });

  describe('charts (ADR-0009)', () => {
    type Chart = { catalogId: string; components: Record<string, unknown>[] };
    const bar = () => structuredClone(VALID_FIXTURES['chart-bar'].artifact) as Chart;

    it('reports the category and series columns as bound columns', () => {
      const result = validateArtifact(VALID_FIXTURES['chart-bar'].artifact);
      expect(result.valid && [...result.boundColumns].sort()).toEqual(['cost', 'region', 'revenue']);
    });

    it('points a chart error at the series and the chart component', () => {
      const result = validateArtifact(INVALID_FIXTURES['chart-series-not-numeric'].artifact);
      expect(result.errors).toEqual([
        expect.objectContaining({ code: 'chart-column-type', path: '/components/0/series/0/valueKey', componentId: 'root' }),
      ]);
    });

    it('reports every chart rule that fails, at once', () => {
      const artifact = bar();
      Object.assign(artifact.components[0], {
        chartType: 'pie',
        data: { path: '/page' },
        series: [{ valueKey: 'region' }, { valueKey: 'profit' }],
      });
      const codes = validateArtifact(artifact).errors.map((error) => error.code).sort();
      expect(codes).toEqual(['chart-column-type', 'chart-series', 'chart-series', 'unknown-column', 'unknown-path']);
    });

    it('applies the chart rules only to artifacts on the ESI catalog', () => {
      const artifact = bar();
      artifact.catalogId = BASIC_CATALOG_ID;
      artifact.components[0]['series'] = [];
      expect(validateArtifact(artifact).errors.map((error) => error.code)).toEqual(['unknown-component']);
    });
  });
});

