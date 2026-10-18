import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const specs = ['core-api/openapi.yaml', 'agents-api/openapi.yaml'];
let failed = false;

for (const spec of specs) {
  const text = readFileSync(spec, 'utf8');
  const match = text.match(/^info:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*["']?([^"'\s]+)["']?/m);
  const version = match?.[1];
  if (version !== pkg.version) {
    console.error(`${spec}: info.version is ${version ?? 'missing'}, package.json is ${pkg.version}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`info.version of all specs matches package version ${pkg.version}`);
