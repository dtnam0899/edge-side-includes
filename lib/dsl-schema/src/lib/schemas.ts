import catalog from '../a2ui/v0_9_1/catalog.json';
import commonTypes from '../a2ui/v0_9_1/common_types.json';
import serverToClient from '../a2ui/v0_9_1/server_to_client.json';
import artifactSchema from '../esi/artifact.schema.json';

/**
 * JSON Schemas (draft 2020-12) for the pinned A2UI version and the ESI artifact envelope.
 * Register all of them in one validator: they reference each other by `$id`.
 */
export const SCHEMAS = {
  /** A2UI v0.9.1 basic catalog (components and functions). */
  basicCatalog: catalog,
  /** A2UI v0.9.1 common types. */
  commonTypes,
  /** A2UI v0.9.1 server-to-client messages. */
  serverToClient,
  /** ESI artifact envelope; its `components` items are basic catalog components. */
  artifact: artifactSchema,
} as const;

/**
 * `common_types.json` and `server_to_client.json` refer to the catalog as `catalog.json`
 * relative to their own `$id`; the A2UI spec resolves that name to the catalog in use.
 * Register the basic catalog under this id as well.
 */
export const CATALOG_ALIAS_ID = 'https://a2ui.org/specification/v0_9/catalog.json';

/** Names of the components in the pinned basic catalog. */
export const BASIC_CATALOG_COMPONENTS: readonly string[] = Object.keys(catalog.components);

/** Names of the functions in the pinned basic catalog. */
export const BASIC_CATALOG_FUNCTIONS: readonly string[] = Object.keys(catalog.functions);
