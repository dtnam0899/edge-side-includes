import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { A2UI_RENDERER_CONFIG, A2uiRendererService, BasicCatalog, MarkdownRenderer, SurfaceComponent } from '@a2ui/angular/v0_9';
import { deleteSurfaceMessage, planSurface, type SurfaceData } from '@dtnam0899/dsl-core';
import { PlainTextMarkdownRenderer } from './plain-text-markdown-renderer';

let nextSurfaceId = 0;

/** What the component shows. */
type ViewState =
  | { kind: 'invalid'; messages: string[] }
  | { kind: 'missing-columns'; columns: string[] }
  | { kind: 'render-error' }
  | { kind: 'pending' }
  | { kind: 'ready'; surfaceId: string; generation: number };

/**
 * Renders one stored ESI DSL artifact with its live query result (one A2UI surface per item).
 *
 * The artifact is untrusted: it is validated with `dsl-core` first, and an invalid artifact or a
 * bound column missing from the result shows an error state instead of the surface. Each instance
 * has its own A2UI renderer service, configured with the pinned basic catalog, and shows all text
 * as plain text.
 */
@Component({
  selector: 'esi-dsl-surface',
  imports: [SurfaceComponent],
  templateUrl: './dsl-surface.html',
  styleUrl: './dsl-surface.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    A2uiRendererService,
    { provide: A2UI_RENDERER_CONFIG, useFactory: () => ({ catalogs: [inject(BasicCatalog)] }) },
    { provide: MarkdownRenderer, useClass: PlainTextMarkdownRenderer },
  ],
})
export class DslSurface {
  /** The stored artifact, as received (validated here before anything is rendered). */
  readonly artifact = input.required<unknown>();
  /** Columns, rows of the current page, and paging of the live query result. */
  readonly data = input.required<SurfaceData>();
  /** A2UI surface id; unique per instance by default. */
  readonly surfaceId = input(`esi-surface-${nextSurfaceId++}`);

  private readonly renderer = inject(A2uiRendererService);
  private readonly renderFailed = signal(false);
  /** The created surface; `generation` changes with each one, so that its element is created again too. */
  private readonly rendered = signal<{ surfaceId: string; generation: number } | undefined>(undefined);
  private generation = 0;
  private active: { surfaceId: string; artifact: unknown } | undefined;

  protected readonly plan = computed(() => planSurface(this.artifact(), this.data(), this.surfaceId()));

  protected readonly view = computed<ViewState>(() => {
    const plan = this.plan();
    if (plan.status === 'invalid') return { kind: 'invalid', messages: plan.errors.map((error) => error.message) };
    if (plan.status === 'missing-columns') return { kind: 'missing-columns', columns: plan.missingColumns };
    if (this.renderFailed()) return { kind: 'render-error' };
    const rendered = this.rendered();
    return rendered?.surfaceId === this.surfaceId() ? { kind: 'ready', ...rendered } : { kind: 'pending' };
  });

  constructor() {
    effect(() => {
      const plan = this.plan();
      untracked(() => {
        if (plan.status !== 'ready') {
          this.release();
          return;
        }
        const surfaceId = this.surfaceId();
        const [, , updateDataModel] = plan.messages;
        try {
          if (this.active?.surfaceId === surfaceId && this.active.artifact === this.artifact()) {
            // Same artifact on the same surface: only the data changed.
            this.renderer.processMessages([updateDataModel]);
            return;
          }
          this.release();
          this.renderFailed.set(false);
          this.active = { surfaceId, artifact: this.artifact() };
          this.renderer.processMessages(plan.messages);
          this.rendered.set({ surfaceId, generation: ++this.generation });
        } catch {
          this.renderFailed.set(true);
          this.release();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.release());
  }

  private release(): void {
    const surfaceId = this.active?.surfaceId;
    this.active = undefined;
    this.rendered.set(undefined);
    if (surfaceId !== undefined && this.renderer.surfaceGroup.getSurface(surfaceId)) {
      this.renderer.processMessages([deleteSurfaceMessage(surfaceId)]);
    }
  }
}
