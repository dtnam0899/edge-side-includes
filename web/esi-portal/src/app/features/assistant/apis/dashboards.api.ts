import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CoreApi,
  Dashboard,
  DashboardItem,
  DashboardSummary,
  ItemLayout,
  addDashboardItemRequest,
  createDashboardRequest,
  deleteDashboardRequest,
  getDashboardRequest,
  listDashboardsRequest,
  removeDashboardItemRequest,
  renameDashboardRequest,
  saveDashboardLayoutRequest,
} from '../../../core/api';

/** HTTP boundary for personal dashboards, their items and layout. Layout never goes into the DSL. */
@Injectable({ providedIn: 'root' })
export class DashboardsApi {
  private readonly api = inject(CoreApi);

  list(connectionId: string): Observable<DashboardSummary[]> {
    return this.api.send((target) => listDashboardsRequest({ ...target, path: { connectionId } }));
  }

  create(connectionId: string, name: string): Observable<Dashboard> {
    return this.api.send((target) =>
      createDashboardRequest({ ...target, path: { connectionId }, body: { name } }),
    );
  }

  get(dashboardId: string): Observable<Dashboard> {
    return this.api.send((target) => getDashboardRequest({ ...target, path: { dashboardId } }));
  }

  rename(dashboardId: string, name: string): Observable<Dashboard> {
    return this.api.send((target) =>
      renameDashboardRequest({ ...target, path: { dashboardId }, body: { name } }),
    );
  }

  delete(dashboardId: string): Observable<void> {
    return this.api.send((target) =>
      deleteDashboardRequest({ ...target, path: { dashboardId } }),
    ) as Observable<void>;
  }

  addItem(dashboardId: string, artifactId: string, layout: ItemLayout): Observable<DashboardItem> {
    return this.api.send((target) =>
      addDashboardItemRequest({ ...target, path: { dashboardId }, body: { artifactId, layout } }),
    );
  }

  removeItem(dashboardId: string, itemId: string): Observable<void> {
    return this.api.send((target) =>
      removeDashboardItemRequest({ ...target, path: { dashboardId, itemId } }),
    ) as Observable<void>;
  }

  /** Every current item exactly once. */
  saveLayout(
    dashboardId: string,
    items: readonly { itemId: string; layout: ItemLayout }[],
  ): Observable<Dashboard> {
    return this.api.send((target) =>
      saveDashboardLayoutRequest({ ...target, path: { dashboardId }, body: { items: [...items] } }),
    );
  }
}
