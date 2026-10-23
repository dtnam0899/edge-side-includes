/**
 * Labels for artifact kinds. core-api returns the kind as an open set (ADR-0010): a later contract version may
 * add kinds this portal does not know, so they get a generic label. Rendering never depends on the kind, only
 * on the DSL.
 */
const KIND_LABELS: Readonly<Record<string, string>> = {
  table: 'Table',
  kpi: 'KPI',
  chart: 'Chart',
};

export function artifactKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Visualization';
}
