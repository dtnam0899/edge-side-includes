// Local ESLint rule enforcing the module rules in CLAUDE.md:
// - a feature (src/app/features/<name>/) must not import another feature;
// - core/ and shared/ must not import any feature;
// - the app root (src/app/*.ts) may import a feature only through its `<name>.routes` file;
// - a feature must not see auth: no `core/auth/` and no `@auth0/*` (ADR-0006; the interceptor adds tokens).
import path from 'node:path';

const FEATURES = `${path.sep}src${path.sep}app${path.sep}features${path.sep}`;
const APP = `${path.sep}src${path.sep}app${path.sep}`;
const CORE_AUTH = `${path.sep}src${path.sep}app${path.sep}core${path.sep}auth`;

function featureOf(file) {
  const i = file.indexOf(FEATURES);
  if (i === -1) return null;
  const [name, ...rest] = file.slice(i + FEATURES.length).split(path.sep);
  return { name, rest: rest.join('/') };
}

function areaOf(file) {
  const i = file.indexOf(APP);
  if (i === -1) return null;
  const rest = file.slice(i + APP.length).split(path.sep);
  return rest.length === 1 ? 'root' : rest[0];
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Keep feature modules independent; expose only their routes.' },
    messages: {
      crossFeature: "Feature '{{from}}' must not import feature '{{to}}'. Move shared code to core/ or shared/, or navigate by route.",
      layerToFeature: "'{{area}}/' must not import feature '{{to}}'.",
      privateFeature: "Import only '{{to}}.routes' from feature '{{to}}', not its internals.",
      featureAuth: "Feature '{{from}}' must not import auth ('{{source}}'); requests are authenticated by core's interceptor.",
    },
    schema: [],
  },
  create(context) {
    const filename = path.resolve(context.filename);
    const from = featureOf(filename);
    const area = areaOf(filename);

    function check(node, source) {
      if (typeof source !== 'string') return;
      if (from && isAuth(source)) {
        context.report({ node, messageId: 'featureAuth', data: { from: from.name, source } });
        return;
      }
      if (!source.startsWith('.')) return;
      const target = featureOf(path.resolve(path.dirname(filename), source));
      if (!target) return;
      if (from) {
        if (from.name !== target.name) context.report({ node, messageId: 'crossFeature', data: { from: from.name, to: target.name } });
      } else if (area === 'root') {
        if (target.rest !== `${target.name}.routes`) context.report({ node, messageId: 'privateFeature', data: { to: target.name } });
      } else if (area) {
        context.report({ node, messageId: 'layerToFeature', data: { area, to: target.name } });
      }
    }

    function isAuth(source) {
      if (source === '@auth0' || source.startsWith('@auth0/')) return true;
      if (!source.startsWith('.')) return false;
      const target = path.resolve(path.dirname(filename), source);
      return target.endsWith(CORE_AUTH) || target.includes(CORE_AUTH + path.sep);
    }

    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) => node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => node.source.type === 'Literal' && check(node, node.source.value),
    };
  },
};
