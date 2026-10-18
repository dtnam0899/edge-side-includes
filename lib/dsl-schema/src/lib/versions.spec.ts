import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { A2UI_PINS, BASIC_CATALOG_ID, DSL_SCHEMA_VERSION, DSL_SCHEMA_VERSIONS } from './versions';
import { BASIC_CATALOG_COMPONENTS, BASIC_CATALOG_FUNCTIONS, SCHEMAS } from './schemas';

const webCoreRoot = join(import.meta.dirname, '../../../node_modules/@a2ui/web_core');
const vendored = (file: string) => JSON.parse(readFileSync(join(import.meta.dirname, '../a2ui/v0_9_1', file), 'utf8'));
const webCore = (file: string) => JSON.parse(readFileSync(join(webCoreRoot, 'src/v0_9/schemas', file), 'utf8'));

describe('pinned A2UI versions', () => {
  it('uses the exact catalogId string from the pinned catalog file', () => {
    expect(BASIC_CATALOG_ID).toBe('https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json');
    expect(BASIC_CATALOG_ID).toBe(vendored('catalog.json').catalogId);
    expect(SCHEMAS.artifact.properties.catalogId.const).toBe(BASIC_CATALOG_ID);
  });

  it('records the protocol/renderer pair for the current artifact version', () => {
    expect(DSL_SCHEMA_VERSIONS[DSL_SCHEMA_VERSION]).toEqual({
      specRelease: 'v0.9.1',
      protocolVersion: 'v0.9',
      renderer: '@a2ui/angular@0.13.0',
      catalogId: BASIC_CATALOG_ID,
    });
    expect(SCHEMAS.artifact.properties.dslSchemaVersion.const).toBe(DSL_SCHEMA_VERSION);
    expect(SCHEMAS.artifact.properties.protocolVersion.const).toBe(A2UI_PINS.protocolVersion);
  });

  it('pins the same renderer versions as the workspace and renderer manifests', () => {
    const manifest = (path: string) => JSON.parse(readFileSync(join(import.meta.dirname, '../../..', path), 'utf8'));
    const workspace = manifest('package.json').devDependencies;
    const renderer = manifest('dsl-renderer-angular/package.json').dependencies;
    for (const deps of [workspace, renderer]) {
      expect(deps[A2UI_PINS.renderer.package]).toBe(A2UI_PINS.renderer.version);
      expect(deps[A2UI_PINS.webCore.package]).toBe(A2UI_PINS.webCore.version);
    }
    expect(JSON.parse(readFileSync(join(webCoreRoot, 'package.json'), 'utf8')).version).toBe(A2UI_PINS.webCore.version);
  });

  it('vendors the same catalog and common types the renderer ships', () => {
    expect(vendored('catalog.json')).toEqual(webCore('catalogs/basic/catalog.json'));
    expect(vendored('common_types.json')).toEqual(webCore('common_types.json'));
  });

  it('accepts the message version the renderer accepts', () => {
    const versions = SCHEMAS.serverToClient.$defs.CreateSurfaceMessage.properties.version.enum;
    expect(versions).toContain(A2UI_PINS.protocolVersion);
    expect(webCore('server_to_client.json').$defs.CreateSurfaceMessage.properties.version.const).toBe(A2UI_PINS.protocolVersion);
  });

  it('lists the 18 basic catalog components', () => {
    expect(BASIC_CATALOG_COMPONENTS).toHaveLength(18);
    expect(BASIC_CATALOG_COMPONENTS).toEqual(expect.arrayContaining(['Text', 'Row', 'Column', 'List', 'Card']));
    expect(BASIC_CATALOG_COMPONENTS).not.toContain('Table');
    expect(BASIC_CATALOG_FUNCTIONS).toEqual(expect.arrayContaining(['formatNumber', 'formatCurrency']));
  });
});
