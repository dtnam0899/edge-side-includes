// Pins internal dependencies in the dist manifests of a release, then checks them (ESI-136).
// `nx release version --projects=<subset>` takes a dependency's version from its source manifest when the
// dependency is not part of the run, and source manifests stay 0.0.0 (versions live in tags). So every
// internal dependency of a released project is set to: its version in this run, or else its latest
// `lib-<project>@v<version>` tag. The script fails if one still has no exact released version.
// Usage (from lib/): node scripts/pin-internal-deps.mjs <comma-separated projects>
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const EXACT = /^\d+\.\d+\.\d+$/;
const SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies'];

const released = (process.argv[2] ?? '').split(',').filter(Boolean);
if (!released.length) {
  console.error('usage: node scripts/pin-internal-deps.mjs <comma-separated projects>');
  process.exit(2);
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// Internal package name -> lib project (the directory name, as in the tag pattern).
const projectByName = new Map(
  readdirSync('.', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(`${entry.name}/project.json`) && existsSync(`${entry.name}/package.json`))
    .map((entry) => [readJson(`${entry.name}/package.json`).name, entry.name]),
);

function latestTag(project) {
  const tags = execFileSync('git', ['tag', '--list', `lib-${project}@v*`, '--sort=-v:refname'], { encoding: 'utf8' })
    .split('\n')
    .map((tag) => tag.slice(`lib-${project}@v`.length))
    .filter((version) => EXACT.test(version));
  return tags[0];
}

function versionOf(project) {
  if (released.includes(project)) return readJson(`dist/${project}/package.json`).version;
  return latestTag(project);
}

const problems = [];
for (const project of released) {
  const path = `dist/${project}/package.json`;
  const manifest = readJson(path);
  let changed = false;
  for (const section of SECTIONS) {
    for (const [name, range] of Object.entries(manifest[section] ?? {})) {
      const dependency = projectByName.get(name);
      if (!dependency) continue;
      const version = versionOf(dependency);
      if (version && EXACT.test(version) && range !== version) {
        console.log(`${project}: ${section} ${name} ${range} -> ${version}`);
        manifest[section][name] = version;
        changed = true;
      }
      if (!EXACT.test(manifest[section][name]) || manifest[section][name] === '0.0.0') {
        problems.push(`${project}: ${section} ${name} is ${manifest[section][name]}, not a released version`);
      }
    }
  }
  if (changed) writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (problems.length) {
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(1);
}
console.log(`internal dependencies of ${released.join(', ')} are exact released versions`);
