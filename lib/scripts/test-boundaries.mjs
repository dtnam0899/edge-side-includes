// Proves that the module-boundary lint rule works: a forbidden import must make lint fail.
// Runs `nx lint` on a temporary file and always removes it.
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const cases = [
  { project: 'dsl-schema', file: 'dsl-schema/src/lib/zz-forbidden.ts', source: "import '@dtnam0899/dsl-core';\n", why: 'scope:schema must not depend on scope:core' },
  { project: 'dsl-core', file: 'dsl-core/src/lib/zz-forbidden.ts', source: "import '@dtnam0899/dsl-renderer-angular';\n", why: 'scope:core must not depend on scope:renderer' },
  { project: 'ui-tokens', file: 'ui-tokens/src/lib/zz-forbidden.ts', source: "import '@dtnam0899/dsl-schema';\n", why: 'scope:tokens must not depend on scope:schema' },
];

let failed = false;
for (const c of cases) {
  writeFileSync(c.file, c.source);
  let lintFailed = false;
  try {
    execFileSync('npx', ['nx', 'lint', c.project, '--skip-nx-cache', '--output-style=static'], { stdio: 'pipe', env: { ...process.env, NX_DAEMON: 'false' } });
  } catch (error) {
    // Other lint errors (for example dependency-checks) must not count: require the boundary rule itself.
    lintFailed = String(error.stdout).includes('@nx/enforce-module-boundaries');
  } finally {
    rmSync(c.file, { force: true });
  }
  if (lintFailed) {
    console.log(`ok: lint rejected the forbidden import (${c.why})`);
  } else {
    console.error(`FAIL: lint accepted a forbidden import (${c.why})`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
