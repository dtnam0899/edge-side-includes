import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { A2uiRendererService, BasicCatalog } from '@a2ui/angular/v0_9';
import type { SurfaceData } from '@dtnam0899/dsl-core';
import { BASIC_CATALOG_ID } from '@dtnam0899/dsl-schema';
import { INVALID_FIXTURES, RENDER_FIXTURES, VALID_FIXTURES } from '@dtnam0899/dsl-schema/fixtures';
import { DslSurface } from './dsl-surface';

async function render(artifact: unknown, data: SurfaceData, surfaceId = 'test-surface'): Promise<ComponentFixture<DslSurface>> {
  const fixture = TestBed.createComponent(DslSurface);
  fixture.componentRef.setInput('artifact', artifact);
  fixture.componentRef.setInput('data', data);
  fixture.componentRef.setInput('surfaceId', surfaceId);
  await settle(fixture);
  return fixture;
}

async function settle(fixture: ComponentFixture<DslSurface>): Promise<void> {
  // Text of the `body` variant resolves asynchronously; let it settle and render again.
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
}

const text = (fixture: ComponentFixture<DslSurface>) => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ').trim() ?? '';
const alert = (fixture: ComponentFixture<DslSurface>) => (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
const surface = (fixture: ComponentFixture<DslSurface>) => (fixture.nativeElement as HTMLElement).querySelector('a2ui-v09-surface');

describe('DslSurface', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DslSurface] }));

  it('uses the basic catalog with the pinned catalogId', () => {
    expect(TestBed.inject(BasicCatalog).id).toBe(BASIC_CATALOG_ID);
  });

  it('renders the table fixture: header, one line per row, formatted numbers and paging', async () => {
    const { artifact, result } = VALID_FIXTURES['table'];
    const fixture = await render(artifact, result);

    expect(alert(fixture)).toBeNull();
    expect(text(fixture)).toContain('Revenue by region');
    expect(text(fixture)).toContain('Region');
    expect(text(fixture)).toContain('North');
    expect(text(fixture)).toContain('1,234.50');
    expect(text(fixture)).toContain('South');
    expect(text(fixture)).toContain('987.00');
    expect(text(fixture)).toMatch(/Rows remaining:\s*0/);
  });

  it('renders the KPI fixture: label and formatted value', async () => {
    const { artifact, result } = VALID_FIXTURES['kpi'];
    const fixture = await render(artifact, result);

    expect(alert(fixture)).toBeNull();
    expect(text(fixture)).toContain('Total revenue');
    expect(text(fixture)).toContain('1,234,567');
  });

  it.each(Object.keys(INVALID_FIXTURES))('rejects the invalid fixture %s before rendering', async (name) => {
    const fixture = await render(INVALID_FIXTURES[name].artifact, VALID_FIXTURES['kpi'].result);

    expect(alert(fixture)?.textContent).toContain('definition is not valid');
    expect(surface(fixture)).toBeNull();
    expect(TestBed.inject(A2uiRendererService).surfaceGroup.getSurface('test-surface')).toBeUndefined();
  });

  it('shows an error state, not empty data, when a bound column is missing from the result', async () => {
    const { artifact, result } = RENDER_FIXTURES['missing-column'];
    const fixture = await render(artifact, result);

    expect(alert(fixture)?.textContent).toContain('no longer has the column revenue');
    expect(surface(fixture)).toBeNull();
    expect(text(fixture)).not.toContain('North');
  });

  it('shows DSL and row values as text, never as HTML or Markdown', async () => {
    const { artifact, result } = RENDER_FIXTURES['untrusted-row-values'];
    const fixture = await render(artifact, result);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('strong')).toBeNull();
    expect(text(fixture)).toContain('<img src=x onerror=alert(1)>');
    expect(text(fixture)).toContain('**bold** {"path":"/page"}');
  });

  it('updates the data model when the data changes and deletes the surface on destroy', async () => {
    const { artifact, result } = VALID_FIXTURES['kpi'];
    const fixture = await render(artifact, result);
    const renderer = fixture.debugElement.injector.get(A2uiRendererService);
    expect(renderer.surfaceGroup.getSurface('test-surface')).toBeDefined();

    fixture.componentRef.setInput('data', { ...result, rows: [{ total_revenue: 42 }] });
    await settle(fixture);
    expect(text(fixture)).toContain('42');
    expect(text(fixture)).not.toContain('1,234,567');

    fixture.componentRef.setInput('artifact', structuredClone(VALID_FIXTURES['table'].artifact));
    fixture.componentRef.setInput('data', VALID_FIXTURES['table'].result);
    await settle(fixture);
    expect(text(fixture)).toContain('Revenue by region');
    expect(text(fixture)).not.toContain('Total revenue');

    fixture.destroy();
    expect(renderer.surfaceGroup.getSurface('test-surface')).toBeUndefined();
  });
});
