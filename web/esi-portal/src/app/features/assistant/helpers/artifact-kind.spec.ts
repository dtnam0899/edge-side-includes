import { artifactKindLabel } from './artifact-kind';

describe('artifactKindLabel', () => {
  it('names the kinds this portal knows', () => {
    expect(['table', 'kpi', 'chart'].map(artifactKindLabel)).toEqual(['Table', 'KPI', 'Chart']);
  });

  it('gives a kind from a later contract version a generic label (ADR-0010)', () => {
    expect(artifactKindLabel('form')).toBe('Visualization');
  });
});
