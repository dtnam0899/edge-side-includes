import { DATA_MODEL_PATHS, PAGE_FIELDS } from '@dtnam0899/dsl-schema';
import { type DslValidationError, pointer } from './errors';
import { isObject, type JsonObject, walk } from './json';

/** A reference from one component to another, by id. */
export interface ChildReference {
  id: string;
  /** Path segments of the reference inside the component. */
  segments: (string | number)[];
  /** Set when the reference is a `ChildList` template: the data model path it iterates. */
  templatePath?: string;
}

/**
 * Child references of one component. In the basic catalog these are `child` (Card, Button, Tabs
 * items), `trigger` and `content` (Modal), and `children` (Row, Column, List), which is either a
 * list of ids or a template `{ componentId, path }`.
 */
export function childReferences(component: JsonObject): ChildReference[] {
  const refs: ChildReference[] = [];
  for (const key of ['child', 'trigger', 'content']) {
    const id = component[key];
    if (typeof id === 'string') refs.push({ id, segments: [key] });
  }
  const children = component['children'];
  if (Array.isArray(children)) {
    children.forEach((id, index) => {
      if (typeof id === 'string') refs.push({ id, segments: ['children', index] });
    });
  } else if (isObject(children) && typeof children['componentId'] === 'string') {
    refs.push({
      id: children['componentId'],
      segments: ['children', 'componentId'],
      templatePath: typeof children['path'] === 'string' ? children['path'] : undefined,
    });
  }
  const tabs = component['tabs'];
  if (Array.isArray(tabs)) {
    tabs.forEach((tab, index) => {
      if (isObject(tab) && typeof tab['child'] === 'string') refs.push({ id: tab['child'], segments: ['tabs', index, 'child'] });
    });
  }
  return refs;
}

/** A data binding found in a component. */
interface Binding {
  path: string;
  segments: (string | number)[];
}

// `${...}` in a formatString value; `\${` is a literal.
const INTERPOLATION = /(?<!\\)\$\{([^}]*)\}/g;
const PLAIN_PATH = /^[^\s(){}$,'"]+$/;

/** Every `{ path }` binding of a component, plus the plain paths interpolated by `formatString`. */
function bindingsOf(component: JsonObject, errors: DslValidationError[], componentIndex: number): Binding[] {
  const bindings: Binding[] = [];
  walk(component, (node, segments) => {
    // `children.path` is a template path, checked with the template.
    if (segments[0] === 'children') return;
    if (isObject(node) && typeof node['path'] === 'string' && Object.keys(node).length === 1) {
      bindings.push({ path: node['path'], segments: [...segments, 'path'] });
    }
    if (isObject(node) && node['call'] === 'formatString' && isObject(node['args']) && typeof node['args']['value'] === 'string') {
      for (const match of node['args']['value'].matchAll(INTERPOLATION)) {
        const expression = match[1].trim();
        const valueSegments = [...segments, 'args', 'value'];
        if (PLAIN_PATH.test(expression)) {
          bindings.push({ path: expression, segments: valueSegments });
        } else {
          errors.push({
            code: 'unsupported-expression',
            message: `formatString interpolation "\${${expression}}" is not a plain data path`,
            path: pointer('components', componentIndex, ...valueSegments),
            componentId: String(component['id']),
          });
        }
      }
    }
  });
  return bindings;
}

function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

export interface BindingAnalysis {
  errors: DslValidationError[];
  /** Column names the components bind to. */
  boundColumns: string[];
}

/**
 * Checks every bound path of the components (ADR-0002, `docs/dsl/README.md`):
 * - absolute paths are `/rows/<index>/<column>` or `/page/<field>`;
 * - a `ChildList` template iterates `/rows`, and components inside it use relative `<column>` paths;
 * - every column is one of `columns`.
 */
export function analyzeBindings(components: JsonObject[], columns: readonly string[]): BindingAnalysis {
  const errors: DslValidationError[] = [];
  const bound = new Set<string>();
  const columnSet = new Set(columns);
  const byId = new Map<string, JsonObject>();
  for (const component of components) {
    if (typeof component['id'] === 'string' && !byId.has(component['id'])) byId.set(component['id'], component);
  }

  // Components reachable from a `/rows` template are rendered once per row.
  const inRow = new Set<JsonObject>();
  const markRow = (id: string) => {
    const component = byId.get(id);
    if (!component || inRow.has(component)) return;
    inRow.add(component);
    for (const ref of childReferences(component)) markRow(ref.id);
  };

  components.forEach((component, index) => {
    for (const ref of childReferences(component)) {
      if (ref.templatePath === undefined) continue;
      if (ref.templatePath === DATA_MODEL_PATHS.rows) {
        markRow(ref.id);
      } else {
        errors.push({
          code: 'unknown-path',
          message: `A list template must iterate "${DATA_MODEL_PATHS.rows}", not "${ref.templatePath}"`,
          path: pointer('components', index, 'children', 'path'),
          componentId: String(component['id']),
        });
      }
    }
  });

  components.forEach((component, index) => {
    const componentId = String(component['id']);
    const row = inRow.has(component);
    for (const ref of childReferences(component)) {
      if (row && ref.templatePath !== undefined) {
        errors.push({
          code: 'unknown-path',
          message: 'A list template cannot be nested inside a row template; rows are flat',
          path: pointer('components', index, 'children', 'path'),
          componentId,
        });
      }
    }
    for (const binding of bindingsOf(component, errors, index)) {
      const at = pointer('components', index, ...binding.segments);
      const column = resolveColumn(binding.path, row);
      if (column === undefined) {
        errors.push({
          code: 'unknown-path',
          message: row
            ? `"${binding.path}" is not a column path; inside a row template use a relative column name, /rows/<index>/<column> or /page/<field>`
            : `"${binding.path}" is not a valid path; use /rows/<index>/<column> or /page/<field>, or a relative column name inside a ${DATA_MODEL_PATHS.rows} template`,
          path: at,
          componentId,
        });
      } else if (column !== null) {
        if (columnSet.has(column)) {
          bound.add(column);
        } else {
          errors.push({
            code: 'unknown-column',
            message: `"${binding.path}" refers to column "${column}", which is not in the column definitions`,
            path: at,
            componentId,
          });
        }
      }
    }
  });

  return { errors, boundColumns: [...bound] };
}

/**
 * The column a path refers to, `null` for a valid non-column path (`/page/<field>`), or
 * `undefined` for an invalid path.
 */
function resolveColumn(path: string, inRow: boolean): string | null | undefined {
  if (!path.startsWith('/')) {
    if (!inRow || path === '' || path.includes('/')) return undefined;
    return decodeSegment(path);
  }
  const segments = path.split('/').slice(1).map(decodeSegment);
  const [root, ...rest] = segments;
  if (`/${root}` === DATA_MODEL_PATHS.rows) {
    return rest.length === 2 && /^(0|[1-9]\d*)$/.test(rest[0]) && rest[1] !== '' ? rest[1] : undefined;
  }
  if (`/${root}` === DATA_MODEL_PATHS.page) {
    return rest.length === 1 && (PAGE_FIELDS as readonly string[]).includes(rest[0]) ? null : undefined;
  }
  return undefined;
}
