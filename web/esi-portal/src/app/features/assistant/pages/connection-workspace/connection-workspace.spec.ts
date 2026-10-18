import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfirmationService } from 'primeng/api';

import { provideCoreApiTesting } from '../../../../../testing/core-api-testing';
import { MOCK_ID, mockConnection } from '../../../../../testing/mocks/core-api.mocks';
import { ConnectionEditorService } from '../../services/connection-editor.service';
import { ConnectionsService } from '../../services/connections.service';
import { ConsentService } from '../../services/consent.service';
import { ConnectionWorkspace } from './connection-workspace';

// jsdom has no ResizeObserver; PrimeNG Tabs uses it for its ink bar.
class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('ConnectionWorkspace', () => {
  beforeAll(() => vi.stubGlobal('ResizeObserver', ResizeObserverStub));
  afterAll(() => vi.unstubAllGlobals());

  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...provideCoreApiTesting(),
        ConsentService,
        ConnectionsService,
        ConnectionEditorService,
        ConfirmationService,
      ],
    }),
  );

  async function render(consent: 'granted' | 'withdrawn') {
    const connections = TestBed.inject(ConnectionsService);
    connections.connections.set([mockConnection({ consent })]);
    connections.loaded.set(true);
    const fixture = TestBed.createComponent(ConnectionWorkspace);
    fixture.componentRef.setInput('connectionId', MOCK_ID);
    await fixture.whenStable();
    return { fixture, connections, el: fixture.nativeElement as HTMLElement };
  }

  it('shows chat for a connection with consent', async () => {
    const { el } = await render('granted');
    expect(el.querySelector('app-chat-panel')).not.toBeNull();
    expect(el.textContent).not.toContain('password');
  });

  it('removes chat history and features at once when consent is withdrawn', async () => {
    const { fixture, connections, el } = await render('granted');
    connections.markWithdrawn(MOCK_ID);
    await fixture.whenStable();

    expect(el.querySelector('app-chat-panel')).toBeNull();
    expect(el.querySelector('app-scripts-panel')).toBeNull();
    expect(el.querySelector('p-tabs')).toBeNull();
    expect(el.textContent).toContain('Consent withdrawn');
    expect([...el.querySelectorAll('button')].map((b) => b.textContent?.trim())).toContain(
      'Grant consent',
    );
  });

  it('says when the connection does not exist', async () => {
    const connections = TestBed.inject(ConnectionsService);
    connections.loaded.set(true);
    const fixture = TestBed.createComponent(ConnectionWorkspace);
    fixture.componentRef.setInput('connectionId', MOCK_ID);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Connection not found');
  });
});
