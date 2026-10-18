import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Artifact,
  ArtifactSummary,
  CoreApi,
  CreateArtifactRequest,
  QueryResult,
  createArtifactRequest,
  deleteArtifactRequest,
  executeArtifactRequest,
  getArtifactRequest,
  listArtifactsRequest,
} from '../../../core/api';

/** HTTP boundary for saved DSL artifacts and their live execution. */
@Injectable({ providedIn: 'root' })
export class ArtifactsApi {
  private readonly api = inject(CoreApi);

  list(connectionId: string): Observable<ArtifactSummary[]> {
    return this.api.send((target) => listArtifactsRequest({ ...target, path: { connectionId } }));
  }

  create(connectionId: string, body: CreateArtifactRequest): Observable<Artifact> {
    return this.api.send((target) =>
      createArtifactRequest({ ...target, path: { connectionId }, body }),
    );
  }

  get(artifactId: string): Observable<Artifact> {
    return this.api.send((target) => getArtifactRequest({ ...target, path: { artifactId } }));
  }

  delete(artifactId: string): Observable<void> {
    return this.api.send((target) =>
      deleteArtifactRequest({ ...target, path: { artifactId } }),
    ) as Observable<void>;
  }

  /** Runs the saved SELECT on live data and returns one page. */
  execute(artifactId: string, page: number): Observable<QueryResult> {
    return this.api.send((target) =>
      executeArtifactRequest({ ...target, path: { artifactId }, body: { page } }),
    );
  }
}
