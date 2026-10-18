import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CoreApi, Script, deleteScriptRequest, listScriptsRequest } from '../../../core/api';

/** HTTP boundary for generated stored-procedure scripts saved to the user's library. */
@Injectable({ providedIn: 'root' })
export class ScriptsApi {
  private readonly api = inject(CoreApi);

  list(connectionId: string): Observable<Script[]> {
    return this.api.send((target) => listScriptsRequest({ ...target, path: { connectionId } }));
  }

  delete(scriptId: string): Observable<void> {
    return this.api.send((target) =>
      deleteScriptRequest({ ...target, path: { scriptId } }),
    ) as Observable<void>;
  }
}
