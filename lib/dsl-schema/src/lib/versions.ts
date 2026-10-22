import catalog from '../a2ui/v0_9_1/catalog.json';
import esiCatalog from '../esi/catalog.json';

/**
 * The pinned A2UI protocol/renderer pair (ADR-0002). This is the only place in `lib` that
 * names these versions; changing any of them is a breaking DSL change.
 */
export const A2UI_PINS = {
  /** A2UI specification release the vendored schema files come from. */
  specRelease: 'v0.9.1',
  /** Value of the `version` field in every A2UI message ESI emits (the renderer accepts only this). */
  protocolVersion: 'v0.9',
  /** Angular renderer, imported only from its `/v0_9` entry point. */
  renderer: { package: '@a2ui/angular', version: '0.13.0', entryPoint: '@a2ui/angular/v0_9' },
  /** Core package of the renderer. */
  webCore: { package: '@a2ui/web_core', version: '0.14.0' },
} as const;

/** `catalogId` of the pinned basic catalog, taken verbatim from the vendored catalog file. */
export const BASIC_CATALOG_ID: string = catalog.catalogId;

/**
 * `catalogId` of the ESI catalog (ADR-0009): the basic catalog unchanged plus `EsiChart`. Only
 * artifacts with a chart use it. Changing the catalog means a new id (`-2`) and a migration.
 */
export const ESI_CATALOG_ID: string = esiCatalog.catalogId;

/** Every catalog an artifact may name, basic first. */
export const CATALOG_IDS: readonly string[] = [BASIC_CATALOG_ID, ESI_CATALOG_ID];

/** Current version of the stored ESI artifact format. */
export const DSL_SCHEMA_VERSION = 1;

/** Every artifact format version, with the A2UI pair it was written for. */
export const DSL_SCHEMA_VERSIONS = {
  1: {
    specRelease: A2UI_PINS.specRelease,
    protocolVersion: A2UI_PINS.protocolVersion,
    renderer: `${A2UI_PINS.renderer.package}@${A2UI_PINS.renderer.version}`,
    catalogIds: CATALOG_IDS,
  },
} as const;

export type DslSchemaVersion = keyof typeof DSL_SCHEMA_VERSIONS;
