import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CoreApi, QueryResult, executeQueryRequest } from '../../../core/api';

/** HTTP boundary for running an approved SELECT, one page at a time. Called only on an explicit user action. */
@Injectable({ providedIn: 'root' })
export class ExecutionsApi {
  private readonly api = inject(CoreApi);

  execute(connectionId: string, sql: string, page: number): Observable<QueryResult> {
    return this.api.send((target) =>
      executeQueryRequest({ ...target, path: { connectionId }, body: { sql, page } }),
    );
  }
}
