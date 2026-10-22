import { Injectable } from '@angular/core';
import { AngularCatalog, BASIC_COMPONENTS, createComponentImplementation } from '@a2ui/angular/v0_9';
import { createBasicCatalogFunctions, ThemeSchema } from '@a2ui/web_core/v0_9/basic_catalog';
import { ESI_CATALOG_ID } from '@dtnam0899/dsl-schema';
import { EsiChart, EsiChartApi } from './esi-chart';

/**
 * The ESI catalog (ADR-0009): the basic catalog's components, functions and theme, unchanged, plus
 * `EsiChart`. Surfaces of artifacts with a chart are created with its id.
 */
@Injectable({ providedIn: 'root' })
export class EsiCatalog extends AngularCatalog {
  constructor() {
    super(
      ESI_CATALOG_ID,
      '0.9',
      [...BASIC_COMPONENTS, createComponentImplementation(EsiChartApi, EsiChart)],
      createBasicCatalogFunctions(),
      ThemeSchema,
    );
  }
}
