import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Connection,
  ConnectionTestResult,
  CoreApi,
  createConnectionRequest,
  deleteConnectionRequest,
  grantConnectionConsentRequest,
  listConnectionsRequest,
  testConnectionRequest,
  updateConnectionRequest,
  withdrawConnectionConsentRequest,
} from '../../../core/api';

/** HTTP boundary for the user's connections and their per-connection consent. Connection strings are write-only. */
@Injectable({ providedIn: 'root' })
export class ConnectionsApi {
  private readonly api = inject(CoreApi);

  list(): Observable<Connection[]> {
    return this.api.send((target) => listConnectionsRequest(target));
  }

  create(name: string, connectionString: string): Observable<Connection> {
    return this.api.send((target) =>
      createConnectionRequest({ ...target, body: { name, connectionString } }),
    );
  }

  /** Omit `connectionString` to keep the stored one. */
  update(connectionId: string, name: string, connectionString?: string): Observable<Connection> {
    return this.api.send((target) =>
      updateConnectionRequest({
        ...target,
        path: { connectionId },
        body: { name, connectionString },
      }),
    );
  }

  delete(connectionId: string): Observable<void> {
    return this.api.send((target) =>
      deleteConnectionRequest({ ...target, path: { connectionId } }),
    ) as Observable<void>;
  }

  test(connectionId: string): Observable<ConnectionTestResult> {
    return this.api.send((target) => testConnectionRequest({ ...target, path: { connectionId } }));
  }

  grantConsent(connectionId: string): Observable<Connection> {
    return this.api.send((target) =>
      grantConnectionConsentRequest({ ...target, path: { connectionId } }),
    );
  }

  withdrawConsent(connectionId: string): Observable<void> {
    return this.api.send((target) =>
      withdrawConnectionConsentRequest({ ...target, path: { connectionId } }),
    ) as Observable<void>;
  }
}
