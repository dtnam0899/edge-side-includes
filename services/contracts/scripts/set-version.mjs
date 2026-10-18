// Release tooling: sets the package version and info.version of every spec to the same value.
// Used by CI before publishing; never run it to hand-edit a released version.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) {
  console.error('usage: node scripts/set-version.mjs <semver>');
  process.exit(2);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
pkg.version = version;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

for (const spec of ['core-api/openapi.yaml', 'agents-api/openapi.yaml']) {
  const text = readFileSync(spec, 'utf8');
  const updated = text.replace(/^(info:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*)["']?[^"'\s]+["']?/m, `$1${version}`);
  if (updated === text && !text.includes(`version: ${version}`)) {
    console.error(`${spec}: info.version not found`);
    process.exit(1);
  }
  writeFileSync(spec, updated);
}

console.log(`set package and spec versions to ${version}`);
