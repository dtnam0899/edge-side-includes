import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import { BASIC_CATALOG_COMPONENTS, BASIC_CATALOG_ID, CATALOG_ALIAS_ID, ESI_CATALOG_ID, SCHEMAS } from '@dtnam0899/dsl-schema';

// The A2UI schemas use keywords Ajv does not know (`catalogId`, `discriminator`), so strict mode is off.
// Formats are not checked; literal content is checked by the ESI rules instead.
// The message schemas refer to the catalog in use as `catalog.json` (CATALOG_ALIAS_ID), so each
// catalog gets its own Ajv instance with the alias pointing at it.
function createAjv(catalogInUse: { $id: string }): Ajv2020 {
  const instance = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  instance.addSchema(SCHEMAS.commonTypes);
  instance.addSchema(SCHEMAS.basicCatalog);
  instance.addSchema(SCHEMAS.esiCatalog);
  instance.addSchema({ ...catalogInUse, $id: CATALOG_ALIAS_ID });
  instance.addSchema(SCHEMAS.serverToClient);
  instance.addSchema(SCHEMAS.artifact);
  return instance;
}

const ajv = createAjv(SCHEMAS.basicCatalog);
let esiAjv: Ajv2020 | undefined;

const componentValidators = new Map<string, ValidateFunction>();

function run(validator: ValidateFunction, value: unknown): ErrorObject[] {
  return validator(value) ? [] : [...(validator.errors ?? [])];
}

/** Validates an artifact against the ESI envelope schema, whose components belong to the artifact's catalog. */
export function validateArtifactSchema(input: unknown): ErrorObject[] {
  return run(ajv.getSchema(SCHEMAS.artifact.$id) as ValidateFunction, input);
}

/** Validates one component against its own catalog schema (basic, or ESI for `EsiChart`), for precise error messages. */
export function validateComponentSchema(name: string, component: unknown): ErrorObject[] {
  let validator = componentValidators.get(name);
  if (!validator) {
    const catalog = BASIC_CATALOG_COMPONENTS.includes(name) ? BASIC_CATALOG_ID : SCHEMAS.esiCatalog.$id;
    validator = ajv.compile({ $ref: `${catalog}#/components/${name}` });
    componentValidators.set(name, validator);
  }
  return run(validator, component);
}

/** Validates one A2UI server-to-client message against the pinned v0.9.1 schema, with the surface's catalog. */
export function validateServerMessage(message: unknown, catalogId: string = BASIC_CATALOG_ID): ErrorObject[] {
  const instance = catalogId === ESI_CATALOG_ID ? (esiAjv ??= createAjv(SCHEMAS.esiCatalog)) : ajv;
  return run(instance.getSchema(SCHEMAS.serverToClient.$id) as ValidateFunction, message);
}
