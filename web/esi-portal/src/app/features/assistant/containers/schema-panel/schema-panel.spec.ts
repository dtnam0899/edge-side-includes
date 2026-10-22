import { TestBed } from '@angular/core/testing';

import { httpTesting, provideCoreApiTesting } from '../../../../../testing/core-api-testing';
import { MOCK_ID, mockSchemaMetadata } from '../../../../../testing/mocks/core-api.mocks';
import { ConnectionsService } from '../../services/connections.service';
import { SchemaPanel } from './schema-panel';

describe('SchemaPanel', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [ConnectionsService, ...provideCoreApiTesting()] }),
  );

  afterEach(() => httpTesting().verify());

  async function render() {
    const fixture = TestBed.createComponent(SchemaPanel);
    fixture.componentRef.setInput('connectionId', MOCK_ID);
    fixture.detectChanges();
    httpTesting().expectOne(`/api/connections/${MOCK_ID}/schema`).flush(mockSchemaMetadata());
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function tableButtons(el: HTMLElement): HTMLButtonElement[] {
    return [...el.querySelectorAll<HTMLButtonElement>('.table-button')];
  }

  it('reads the schema when it opens and summarizes it', async () => {
    const { el } = await render();
    const summary = el.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ');
    expect(summary).toContain('2 tables, 1 view, 1 relationship in 1 schema; 1 stored procedure.');
    expect(tableButtons(el).map((b) => b.querySelector('span')?.textContent)).toEqual([
      'dbo.Customers',
      'dbo.Orders',
      'dbo.vw_CustomerRevenue',
    ]);
    expect(el.querySelectorAll('app-erd-diagram g.node')).toHaveLength(3);
    expect(el.querySelectorAll('app-erd-diagram path.edge')).toHaveLength(1);
  });

  it('filters the list and the diagram by name', async () => {
    const { fixture, el } = await render();
    const search = el.querySelector<HTMLInputElement>('#schema-search')!;
    search.value = 'order';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(tableButtons(el)).toHaveLength(1);
    expect(el.querySelectorAll('app-erd-diagram g.node')).toHaveLength(1);
  });

  it('shows the columns and relations of a selected table and can focus on them', async () => {
    const { fixture, el } = await render();
    tableButtons(el)[1].click();
    await fixture.whenStable();

    const details = el.querySelector('.details')!;
    expect(details.querySelector('h4')?.textContent).toBe('dbo.Orders');
    expect(details.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(details.textContent).toContain('References');
    expect(details.textContent).toContain('dbo.Customers');

    const focus = el.querySelector<HTMLInputElement>('.focus input')!;
    focus.checked = true;
    focus.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(el.querySelectorAll('app-erd-diagram g.node')).toHaveLength(2);
  });
});
