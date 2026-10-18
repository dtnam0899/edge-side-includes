import type { SurfaceData } from '@dtnam0899/dsl-core';

import type { ApiProblem, QueryResult } from '../../../core/api';

/** Live rows of one saved visualization. A failure carries its problem and never empty data. */
export type LiveData =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly result: QueryResult; readonly data: SurfaceData }
  | { readonly status: 'failure'; readonly problem: ApiProblem };
