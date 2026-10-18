export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Visits every value below `value`, depth first, with its path segments relative to `value`. */
export function walk(
  value: unknown,
  visit: (node: unknown, segments: (string | number)[]) => void,
  segments: (string | number)[] = [],
): void {
  visit(value, segments);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...segments, index]));
  } else if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      walk(item, visit, [...segments, key]);
    }
  }
}
