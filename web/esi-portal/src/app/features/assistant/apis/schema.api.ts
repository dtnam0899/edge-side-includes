import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CoreApi, SchemaMetadata, getConnectionSchemaRequest } from '../../../core/api';

/** HTTP boundary for the structure of a connected database (tables, columns, keys); never row values. */
@Injectable({ providedIn: 'root' })
export class SchemaApi {
  private readonly api = inject(CoreApi);

  get(connectionId: string): Observable<SchemaMetadata> {
    return this.api.send((target) =>
      getConnectionSchemaRequest({ ...target, path: { connectionId } }),
    );
  }
}
