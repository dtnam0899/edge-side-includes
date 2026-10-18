import { TestBed } from '@angular/core/testing';

import {
  httpTesting,
  problemResponse,
  provideCoreApiTesting,
} from '../../../../testing/core-api-testing';
import {
  MOCK_ID_3,
  MOCK_ID_4,
  mockArtifact,
  mockArtifactSummary,
  mockDashboard,
  mockDashboardItem,
  mockKpiResult,
  mockProblem,
} from '../../../../testing/mocks/core-api.mocks';
import { ConnectionsService } from './connections.service';
import { DashboardService, LAYOUT_SAVE_DELAY_MS } from './dashboard.service';

const A = 'a0000000-0000-0000-0000-000000000001';
const B = 'b0000000-0000-0000-0000-000000000002';
const C = 'c0000000-0000-0000-0000-000000000003';
const ART_B = 'b1000000-0000-0000-0000-000000000002';

describe('DashboardService', () => {
  let board: DashboardService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [DashboardService, ConnectionsService, ...provideCoreApiTesting()],
    });
    board = TestBed.inject(DashboardService);
  });

  afterEach(() => {
    httpTesting().verify();
    vi.useRealTimers();
  });

  function open(): void {
    board.load(MOCK_ID_4);
    httpTesting()
      .expectOne(`/api/dashboards/${MOCK_ID_4}`)
      .flush(
        mockDashboard({
          items: [
            mockDashboardItem(A, { layout: { x: 0, y: 0, width: 3, height: 2 } }),
            mockDashboardItem(B, {
              artifactId: ART_B,
              artifact: mockArtifact({ id: ART_B, name: 'Broken' }),
              layout: { x: 3, y: 0, width: 3, height: 2 },
            }),
            mockDashboardItem(C, {
              artifactId: MOCK_ID_3,
              artifact: undefined,
              status: 'missing',
              layout: { x: 6, y: 0, width: 3, height: 2 },
            }),
          ],
        }),
      );
  }

  it('runs every available item on its own, so one failure does not affect the others', () => {
    open();
    const runs = httpTesting().match((r) => r.url.endsWith('/executions'));
    expect(runs.map((r) => r.request.url)).toEqual([
      `/api/artifacts/${MOCK_ID_3}/executions`,
      `/api/artifacts/${ART_B}/executions`,
    ]);
    runs[1].flush(
      mockProblem('execution-failed', 422, { detail: 'Divide by zero error encountered.' }),
      problemResponse(422),
    );
    runs[0].flush(mockKpiResult());

    expect(board.live().get(A)?.status).toBe('ready');
    expect(board.live().get(B)?.status).toBe('failure');
    expect(board.live().has(C)).toBe(false);
    expect(board.items().find((i) => i.id === C)?.status).toBe('missing');
  });

  it('saves the layout once after quick changes, with every item exactly once', () => {
    open();
    httpTesting()
      .match((r) => r.url.endsWith('/executions'))
      .forEach((r) => r.flush(mockKpiResult()));

    board.changeLayout(A, { x: 0, y: 2, width: 3, height: 2 });
    board.changeLayout(A, { x: 0, y: 2, width: 4, height: 3 });
    expect(board.layoutState()).toBe('saving');
    httpTesting().expectNone(`/api/dashboards/${MOCK_ID_4}/layout`);

    vi.advanceTimersByTime(LAYOUT_SAVE_DELAY_MS);
    const save = httpTesting().expectOne({
      method: 'PUT',
      url: `/api/dashboards/${MOCK_ID_4}/layout`,
    });
    const body = save.request.body as { items: { itemId: string; layout: object }[] };
    expect(body.items.map((i) => i.itemId).sort()).toEqual([A, B, C].sort());
    expect(body.items.find((i) => i.itemId === A)?.layout).toEqual({
      x: 0,
      y: 2,
      width: 4,
      height: 3,
    });
    save.flush(mockDashboard());
    expect(board.layoutState()).toBe('saved');
  });

  it('keeps the local layout and offers a retry when saving fails', () => {
    open();
    httpTesting()
      .match((r) => r.url.endsWith('/executions'))
      .forEach((r) => r.flush(mockKpiResult()));
    board.changeLayout(B, { x: 0, y: 4, width: 6, height: 4 });
    vi.advanceTimersByTime(LAYOUT_SAVE_DELAY_MS);
    httpTesting()
      .expectOne(`/api/dashboards/${MOCK_ID_4}/layout`)
      .flush({ type: 'about:blank', title: 'Error', status: 500 }, problemResponse(500));
    expect(board.layoutState()).toBe('failed');
    expect(board.items().find((i) => i.id === B)?.layout.width).toBe(6);

    board.retryLayout();
    vi.advanceTimersByTime(LAYOUT_SAVE_DELAY_MS);
    httpTesting().expectOne(`/api/dashboards/${MOCK_ID_4}/layout`).flush(mockDashboard());
    expect(board.layoutState()).toBe('saved');
  });

  it('repairs a stored layout with overlapping items', () => {
    board.load(MOCK_ID_4);
    httpTesting()
      .expectOne(`/api/dashboards/${MOCK_ID_4}`)
      .flush(
        mockDashboard({
          items: [
            mockDashboardItem(A),
            mockDashboardItem(B, { layout: { x: 1, y: 1, width: 3, height: 2 } }),
          ],
        }),
      );
    httpTesting()
      .match((r) => r.url.endsWith('/executions'))
      .forEach((r) => r.flush(mockKpiResult()));
    vi.advanceTimersByTime(LAYOUT_SAVE_DELAY_MS);
    const save = httpTesting().expectOne(`/api/dashboards/${MOCK_ID_4}/layout`);
    expect(
      (save.request.body as { items: { itemId: string; layout: { y: number } }[] }).items.find(
        (i) => i.itemId === B,
      )?.layout.y,
    ).toBe(2);
    save.flush(mockDashboard());
  });

  it('adds an item below the others and runs it', () => {
    open();
    httpTesting()
      .match((r) => r.url.endsWith('/executions'))
      .forEach((r) => r.flush(mockKpiResult()));
    board.addItem(mockArtifactSummary({ kind: 'table' }));
    const add = httpTesting().expectOne({
      method: 'POST',
      url: `/api/dashboards/${MOCK_ID_4}/items`,
    });
    expect(add.request.body).toEqual({
      artifactId: MOCK_ID_3,
      layout: { x: 0, y: 2, width: 6, height: 5 },
    });
    add.flush(
      mockDashboardItem('d0000000-0000-0000-0000-000000000004', {
        layout: { x: 0, y: 2, width: 6, height: 5 },
      }),
    );
    httpTesting().expectOne(`/api/artifacts/${MOCK_ID_3}/executions`).flush(mockKpiResult());
    expect(board.items()).toHaveLength(4);
  });
});
