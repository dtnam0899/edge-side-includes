// Public surface of the core-api client for feature modules.
export type * from './generated/types.gen';
export * from './generated/@angular/common.gen';
export { CORE_API_CONTRACT_VERSION } from './generated/contract-version.gen';
export { CoreApi, type RequestTarget } from './core-api';
export { type ApiProblem, toApiProblem } from './api-problem';
