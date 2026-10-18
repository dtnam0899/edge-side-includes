// Proves that the feature-boundary lint rule works: each forbidden import must fail lint with
// `esi/feature-boundaries`. Writes temporary files under src/app and always removes them.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const tmpFeature = 'src/app/features/zz-boundary-test';
const cases = [
  { file: `${tmpFeature}/zz.ts`, source: "import '../assistant/pages/assistant-page/assistant-page';\n", why: 'a feature imports another feature' },
  { file: 'src/app/core/zz-boundary-test.ts', source: "import '../features/assistant/assistant.routes';\n", why: 'core imports a feature' },
  { file: 'src/app/zz-boundary-test.ts', source: "import './features/assistant/pages/assistant-page/assistant-page';\n", why: 'the app root imports feature internals' },
];

let failed = false;
mkdirSync(tmpFeature, { recursive: true });
try {
  for (const c of cases) {
    writeFileSync(c.file, c.source);
    let rejected = false;
    try {
      execFileSync('npx', ['eslint', c.file], { stdio: 'pipe' });
    } catch (error) {
      rejected = String(error.stdout).includes('esi/feature-boundaries');
    } finally {
      rmSync(c.file, { force: true });
    }
    console[rejected ? 'log' : 'error'](`${rejected ? 'ok' : 'FAIL'}: ${c.why}`);
    failed ||= !rejected;
  }
} finally {
  rmSync(tmpFeature, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
