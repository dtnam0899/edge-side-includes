import { TestBed } from '@angular/core/testing';

import { httpTesting, provideCoreApiTesting } from '../../../../testing/core-api-testing';
import {
  MOCK_CONNECTION_STRING,
  MOCK_ID,
  MOCK_ID_2,
  mockConnection,
} from '../../../../testing/mocks/core-api.mocks';
import { ConnectionsService } from './connections.service';

describe('ConnectionsService', () => {
  let connections: ConnectionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConnectionsService, ...provideCoreApiTesting()] });
    connections = TestBed.inject(ConnectionsService);
    connections.load();
    httpTesting().expectOne('/api/connections').flush([mockConnection()]);
  });

  afterEach(() => httpTesting().verify());

  it('sends the connection string only when creating and keeps no copy of it', () => {
    connections.create('Orders', MOCK_CONNECTION_STRING).subscribe();
    const request = httpTesting().expectOne({ method: 'POST', url: '/api/connections' });
    expect(request.request.body).toEqual({
      name: 'Orders',
      connectionString: MOCK_CONNECTION_STRING,
    });
    request.flush(mockConnection({ id: MOCK_ID_2, name: 'Orders' }));

    expect(connections.connections().map((c) => c.name)).toEqual(['Orders', 'Sales DB']);
    expect(JSON.stringify(connections.connections())).not.toContain('Password');
  });

  it('omits the connection string on rename', () => {
    connections.update(MOCK_ID, 'Sales').subscribe();
    const request = httpTesting().expectOne({ method: 'PUT', url: `/api/connections/${MOCK_ID}` });
    expect(request.request.body).toEqual({ name: 'Sales' });
    request.flush(mockConnection({ name: 'Sales' }));
    expect(connections.find(MOCK_ID)?.name).toBe('Sales');
  });

  it('marks the connection withdrawn as soon as consent is withdrawn', () => {
    connections.withdrawConsent(MOCK_ID).subscribe();
    httpTesting()
      .expectOne({ method: 'DELETE', url: `/api/connections/${MOCK_ID}/consent` })
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(connections.find(MOCK_ID)?.consent).toBe('withdrawn');
  });
});
