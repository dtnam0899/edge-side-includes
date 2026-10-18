import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import { BASIC_CATALOG_ID, CATALOG_ALIAS_ID, SCHEMAS } from '@dtnam0899/dsl-schema';

// The A2UI schemas use keywords Ajv does not know (`catalogId`, `discriminator`), so strict mode is off.
// Formats are not checked; literal content is checked by the ESI rules instead.
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema(SCHEMAS.commonTypes);
ajv.addSchema(SCHEMAS.basicCatalog);
ajv.addSchema({ ...SCHEMAS.basicCatalog, $id: CATALOG_ALIAS_ID });
ajv.addSchema(SCHEMAS.serverToClient);
ajv.addSchema(SCHEMAS.artifact);

const componentValidators = new Map<string, ValidateFunction>();

function run(validator: ValidateFunction, value: unknown): ErrorObject[] {
  return validator(value) ? [] : [...(validator.errors ?? [])];
}

/** Validates an artifact against the ESI envelope schema, whose components are basic catalog components. */
export function validateArtifactSchema(input: unknown): ErrorObject[] {
  return run(ajv.getSchema(SCHEMAS.artifact.$id) as ValidateFunction, input);
}

/** Validates one component against its own basic catalog schema, for precise error messages. */
export function validateComponentSchema(name: string, component: unknown): ErrorObject[] {
  let validator = componentValidators.get(name);
  if (!validator) {
    validator = ajv.compile({ $ref: `${BASIC_CATALOG_ID}#/components/${name}` });
    componentValidators.set(name, validator);
  }
  return run(validator, component);
}

/** Validates one A2UI server-to-client message against the pinned v0.9.1 schema. */
export function validateServerMessage(message: unknown): ErrorObject[] {
  return run(ajv.getSchema(SCHEMAS.serverToClient.$id) as ValidateFunction, message);
}
