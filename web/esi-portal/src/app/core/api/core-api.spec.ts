import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { httpTesting, provideCoreApiTesting } from '../../../testing/core-api-testing';
import { MOCK_ID, mockConnection } from '../../../testing/mocks/core-api.mocks';
import { CoreApi } from './core-api';
import { executeQueryRequest, listConnectionsRequest } from './generated/@angular/common.gen';

describe('CoreApi', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideCoreApiTesting() }));

  it('sends generated requests under the runtime base URL and returns the body', async () => {
    const result = firstValueFrom(
      TestBed.inject(CoreApi).send((target) => listConnectionsRequest(target)),
    );

    httpTesting().expectOne({ method: 'GET', url: '/api/connections' }).flush([mockConnection()]);

    expect(await result).toEqual([mockConnection()]);
  });

  it('fills path parameters and serializes the JSON body', async () => {
    const result = firstValueFrom(
      TestBed.inject(CoreApi).send((target) =>
        executeQueryRequest({
          ...target,
          path: { connectionId: MOCK_ID },
          body: { sql: 'SELECT 1 AS One', page: 2 },
        }),
      ),
    );

    const request = httpTesting().expectOne(`/api/connections/${MOCK_ID}/executions`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body;
    expect(typeof body === 'string' ? JSON.parse(body) : body).toEqual({
      sql: 'SELECT 1 AS One',
      page: 2,
    });
    request.flush({});
    await result;
  });
});
