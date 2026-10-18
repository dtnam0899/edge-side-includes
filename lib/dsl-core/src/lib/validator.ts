import type { ErrorObject } from 'ajv/dist/2020';
import {
  BASIC_CATALOG_COMPONENTS,
  BASIC_CATALOG_FUNCTIONS,
  type DslArtifact,
  ROOT_COMPONENT_ID,
} from '@dtnam0899/dsl-schema';
import { analyzeBindings, childReferences } from './bindings';
import { type DslValidationError, pointer } from './errors';
import { isObject, type JsonObject, walk } from './json';
import { validateArtifactSchema, validateComponentSchema } from './schema-validator';

export type DslValidationResult =
  | { valid: true; artifact: DslArtifact; boundColumns: string[]; errors: [] }
  | { valid: false; errors: DslValidationError[] };

/** Top-level keys that would mean the artifact carries data rather than column keys. */
const ROW_DATA_KEYS = ['rows', 'data', 'dataModel', 'values', 'updateDataModel'];

// Tag-like text (`<b>`, `</p>`, `<!--`, `<?`) and script URLs. Markdown is allowed; HTML is not.
const UNSAFE_CONTENT = [/<\s*[a-z!/?]/i, /\b(?:javascript|vbscript)\s*:/i, /\bdata\s*:\s*text\/html/i];

const knownComponents = new Set(BASIC_CATALOG_COMPONENTS);
const knownFunctions = new Set(BASIC_CATALOG_FUNCTIONS);

/**
 * Validates an untrusted DSL artifact, in the order of ADR-0002: the A2UI v0.9.1 JSON Schema
 * (through the ESI envelope schema), then the ESI rules. All errors are returned so that an agent
 * can fix them in one retry. Only a `valid` result may be rendered or saved.
 */
export function validateArtifact(input: unknown): DslValidationResult {
  if (!isObject(input)) {
    return { valid: false, errors: [{ code: 'schema', message: 'The artifact must be a JSON object', path: '' }] };
  }
  const components = Array.isArray(input['components']) ? input['components'].filter(isObject) : [];
  const columns = Array.isArray(input['columns'])
    ? input['columns'].filter(isObject).map((c) => c['name']).filter((n): n is string => typeof n === 'string')
    : [];

  const esiErrors = [
    ...rowDataErrors(input),
    ...componentErrors(components),
    ...unsafeContentErrors(components),
  ];
  const bindings = analyzeBindings(components, columns);
  const errors = [...schemaErrors(input, components), ...esiErrors, ...bindings.errors];

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, artifact: input as unknown as DslArtifact, boundColumns: bindings.boundColumns, errors: [] };
}

function schemaErrors(input: JsonObject, components: JsonObject[]): DslValidationError[] {
  const errors: DslValidationError[] = [];
  const reported = new Set<number>();
  for (const error of validateArtifactSchema(input)) {
    const match = /^\/components\/(\d+)(?:\/|$)/.exec(error.instancePath);
    if (!match) {
      // Row data keys get their own, clearer error.
      if (error.keyword === 'additionalProperties' && ROW_DATA_KEYS.includes(String(error.params['additionalProperty']))) continue;
      errors.push(fromAjv(error));
      continue;
    }
    // Errors inside one component: the catalog's `oneOf` over all components reports every branch,
    // so validate the component against its own schema instead, once.
    const index = Number(match[1]);
    if (reported.has(index)) continue;
    reported.add(index);
    const component = components[index];
    const name = component?.['component'];
    // Unknown components and functions are reported by the ESI rules.
    if (typeof name !== 'string' || !knownComponents.has(name) || hasUnknownFunction(component)) continue;
    for (const componentError of validateComponentSchema(name, component)) {
      errors.push({ ...fromAjv(componentError, `/components/${index}`), componentId: String(component['id']) });
    }
  }
  return errors;
}

function fromAjv(error: ErrorObject, prefix = ''): DslValidationError {
  const path = prefix + error.instancePath;
  const detail =
    error.keyword === 'additionalProperties' || error.keyword === 'unevaluatedProperties'
      ? `${error.message}: "${String(error.params['additionalProperty'] ?? error.params['unevaluatedProperty'])}"`
      : error.keyword === 'enum' || error.keyword === 'const'
        ? `${error.message}: ${JSON.stringify(error.params['allowedValues'] ?? error.params['allowedValue'])}`
        : error.message;
  return { code: 'schema', message: `${path || 'artifact'} ${detail ?? 'is invalid'}`, path };
}

function rowDataErrors(input: JsonObject): DslValidationError[] {
  return ROW_DATA_KEYS.filter((key) => key in input).map((key) => ({
    code: 'row-data' as const,
    message: `The artifact must not carry row data ("${key}"); bind components to columns instead`,
    path: pointer(key),
  }));
}

function hasUnknownFunction(component: JsonObject): boolean {
  let unknown = false;
  walk(component, (node) => {
    if (isObject(node) && typeof node['call'] === 'string' && !knownFunctions.has(node['call'])) unknown = true;
  });
  return unknown;
}

function componentErrors(components: JsonObject[]): DslValidationError[] {
  const errors: DslValidationError[] = [];
  const ids = new Set<string>();
  components.forEach((component, index) => {
    const id = component['id'];
    if (typeof id === 'string') {
      if (ids.has(id)) {
        errors.push({ code: 'duplicate-id', message: `Component id "${id}" is used more than once`, path: pointer('components', index, 'id'), componentId: id });
      }
      ids.add(id);
    }
    const name = component['component'];
    if (typeof name === 'string' && !knownComponents.has(name)) {
      errors.push({
        code: 'unknown-component',
        message: `"${name}" is not a component of the pinned basic catalog`,
        path: pointer('components', index, 'component'),
        componentId: String(id),
      });
    }
    walk(component, (node, segments) => {
      if (isObject(node) && typeof node['call'] === 'string' && !knownFunctions.has(node['call'])) {
        errors.push({
          code: 'unknown-function',
          message: `"${node['call']}" is not a function of the pinned basic catalog`,
          path: pointer('components', index, ...segments, 'call'),
          componentId: String(id),
        });
      }
    });
  });
  if (!ids.has(ROOT_COMPONENT_ID)) {
    errors.push({ code: 'missing-root', message: `No component has the id "${ROOT_COMPONENT_ID}"`, path: pointer('components') });
  }
  components.forEach((component, index) => {
    for (const ref of childReferences(component)) {
      if (!ids.has(ref.id)) {
        errors.push({
          code: 'missing-reference',
          message: `Component "${String(component['id'])}" refers to "${ref.id}", which does not exist`,
          path: pointer('components', index, ...ref.segments),
          componentId: String(component['id']),
        });
      }
    }
  });
  return errors;
}

function unsafeContentErrors(components: JsonObject[]): DslValidationError[] {
  const errors: DslValidationError[] = [];
  components.forEach((component, index) => {
    walk(component, (node, segments) => {
      if (typeof node === 'string' && UNSAFE_CONTENT.some((pattern) => pattern.test(node))) {
        errors.push({
          code: 'unsafe-content',
          message: 'Literal text must not contain HTML or script URLs',
          path: pointer('components', index, ...segments),
          componentId: String(component['id']),
        });
      }
    });
  });
  return errors;
}
