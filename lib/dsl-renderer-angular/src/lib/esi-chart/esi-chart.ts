import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  type OnInit,
  signal,
  type Signal,
  viewChild,
} from '@angular/core';
import { A2uiRendererService, CatalogComponent } from '@a2ui/angular/v0_9';
import { DataContext } from '@a2ui/web_core/v0_9';
import { type ChartSeries, CHART_TYPES, DATA_MODEL_PATHS, ESI_CHART_COMPONENT, type PageInfo } from '@dtnam0899/dsl-schema';
import { CHART_BACKGROUNDS, CHART_COLOR_PROPERTIES, CHART_COLORS, type ChartColors, type ColorScheme } from '@dtnam0899/ui-tokens';
import { z } from 'zod';
import { buildChartConfig, type ChartHandle, ESI_CHART_LOADER } from './chart-config';
import { buildChartModel, fallbackMessage } from './chart-model';

/**
 * The A2UI component API of `EsiChart` (ADR-0009). The authoritative schema is the ESI catalog in
 * `@dtnam0899/dsl-schema`, which `dsl-core` validates before anything is rendered; this one only
 * types the properties the renderer binds.
 */
export const EsiChartApi = {
  name: ESI_CHART_COMPONENT,
  schema: z
    .object({
      weight: z.number().optional(),
      accessibility: z.object({ label: z.string().optional(), description: z.string().optional() }).optional(),
      chartType: z.enum(CHART_TYPES),
      title: z.string(),
      categoryKey: z.string(),
      series: z.array(z.object({ valueKey: z.string(), label: z.string().optional() }).strict()),
      // Bound to `/rows`; resolves to the rows of the current page.
      data: z.union([z.object({ path: z.string() }).strict(), z.array(z.record(z.string(), z.unknown()))]),
      stacked: z.boolean().optional(),
    })
    .strict(),
};

/**
 * Draws an `EsiChart` with Chart.js, loaded on first use. The canvas has a text alternative, a
 * "View as table" toggle shows the same rows as text, and a caption built from `/page` says how
 * many of the result's rows the chart shows. A pie that cannot be drawn shows the table instead.
 */
@Component({
  selector: 'esi-chart',
  templateUrl: './esi-chart.html',
  styleUrl: './esi-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EsiChart extends CatalogComponent<typeof EsiChartApi> implements OnInit {
  private readonly renderer = inject(A2uiRendererService);
  private readonly loadChart = inject(ESI_CHART_LOADER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly pageSource = signal<Signal<PageInfo | undefined> | undefined>(undefined);

  protected readonly tableView = signal(false);
  protected readonly loadFailed = signal(false);

  private readonly rows = computed(() => {
    const data = this.props()['data']?.value();
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  });

  protected readonly model = computed(() => {
    const props = this.props();
    return buildChartModel(
      {
        chartType: props['chartType']?.value() ?? 'bar',
        title: props['title']?.value() ?? '',
        categoryKey: props['categoryKey']?.value() ?? '',
        series: (props['series']?.value() ?? []) as ChartSeries[],
        stacked: props['stacked']?.value(),
      },
      this.rows(),
      this.pageSource()?.(),
    );
  });

  protected readonly fallback = computed(() => {
    const fallback = this.model().fallback;
    return fallback ? fallbackMessage(fallback, this.rows().length) : undefined;
  });

  protected readonly showTable = computed(() => this.tableView() || this.fallback() !== undefined || this.loadFailed());

  constructor() {
    super();
    effect((onCleanup) => {
      const canvas = this.canvas()?.nativeElement;
      const model = this.model();
      if (!canvas || model.fallback) return;
      let chart: ChartHandle | undefined;
      let cancelled = false;
      this.loadChart()
        .then((create) => {
          if (cancelled) return;
          const scheme = colorScheme();
          chart = create(canvas, buildChartConfig(model, chartColors(this.host.nativeElement, scheme), CHART_BACKGROUNDS[scheme]));
        })
        .catch(() => this.loadFailed.set(true));
      onCleanup(() => {
        cancelled = true;
        chart?.destroy();
      });
    });
  }

  ngOnInit(): void {
    // Paging is not a chart property: read `/page` of this surface's data model directly.
    const surface = this.renderer.surfaceGroup.getSurface(this.surfaceId());
    if (!surface) return;
    const page = new DataContext(surface, '/').resolveSignal<PageInfo | undefined>({ path: DATA_MODEL_PATHS.page });
    this.pageSource.set(page as unknown as Signal<PageInfo | undefined>);
    const unsubscribe = (page as { unsubscribe?: () => void }).unsubscribe;
    if (unsubscribe) this.destroyRef.onDestroy(() => unsubscribe.call(page));
  }

  protected toggleTable(): void {
    this.tableView.update((table) => !table);
  }
}

function colorScheme(): ColorScheme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Default colors for the scheme, overridden by the `--esi-chart-*` properties of the host page. */
function chartColors(element: HTMLElement, scheme: ColorScheme): ChartColors {
  const defaults = CHART_COLORS[scheme];
  const style = getComputedStyle(element);
  const read = (property: string, fallback: string) => style.getPropertyValue(property).trim() || fallback;
  const series = CHART_COLOR_PROPERTIES.series.map((property, index) => read(property, defaults.series[index]));
  return {
    series: series as unknown as ChartColors['series'],
    slices: [...series, ...defaults.slices.slice(series.length)],
    axis: read(CHART_COLOR_PROPERTIES.axis, defaults.axis),
    grid: read(CHART_COLOR_PROPERTIES.grid, defaults.grid),
    text: read(CHART_COLOR_PROPERTIES.text, defaults.text),
  };
}
