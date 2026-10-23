import { TestBed } from '@angular/core/testing';

import {
  httpTesting,
  problemResponse,
  provideCoreApiTesting,
} from '../../../../testing/core-api-testing';
import {
  MOCK_ID,
  mockConnection,
  mockProblem,
  mockSchemaMetadata,
} from '../../../../testing/mocks/core-api.mocks';
import { ConnectionsService } from './connections.service';
import { SchemaService } from './schema.service';

describe('SchemaService', () => {
  let schema: SchemaService;
  let connections: ConnectionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SchemaService, ConnectionsService, ...provideCoreApiTesting()],
    });
    schema = TestBed.inject(SchemaService);
    connections = TestBed.inject(ConnectionsService);
  });

  afterEach(() => httpTesting().verify());

  it('reads the schema of the connection into the diagram model', () => {
    schema.load(MOCK_ID);
    expect(schema.loading()).toBe(true);
    httpTesting().expectOne(`/api/connections/${MOCK_ID}/schema`).flush(mockSchemaMetadata());

    expect(schema.loading()).toBe(false);
    expect(schema.model()?.tables).toHaveLength(3);
    expect(schema.problem()).toBeNull();
  });

  it('marks the connection withdrawn when consent was withdrawn elsewhere', () => {
    connections.connections.set([mockConnection()]);
    schema.load(MOCK_ID);
    httpTesting()
      .expectOne(`/api/connections/${MOCK_ID}/schema`)
      .flush(mockProblem('consent-withdrawn', 403), problemResponse(403));

    expect(schema.problem()?.name).toBe('consent-withdrawn');
    expect(schema.model()).toBeNull();
    expect(connections.connections()[0].consent).toBe('withdrawn');
  });
});
