import { TestBed } from '@angular/core/testing';

import {
  MOCK_CONNECTION_STRING,
  mockConnection,
} from '../../../../../testing/mocks/core-api.mocks';
import { ConnectionFormDialog, ConnectionFormValue } from './connection-form-dialog';

async function render(connection: ReturnType<typeof mockConnection> | null = null) {
  const fixture = TestBed.createComponent(ConnectionFormDialog);
  fixture.componentRef.setInput('connection', connection);
  fixture.componentRef.setInput('visible', true);
  await fixture.whenStable();
  const root = () => document.body;
  const saved: ConnectionFormValue[] = [];
  fixture.componentInstance.saved.subscribe((value) => saved.push(value));
  const input = (id: string) => root().querySelector<HTMLInputElement>(`#${id}`)!;
  const type = async (id: string, value: string) => {
    input(id).value = value;
    input(id).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const submit = async () => {
    root().querySelector<HTMLFormElement>('#connection-form')!.requestSubmit();
    await fixture.whenStable();
  };
  return { fixture, root, input, type, submit, saved };
}

describe('ConnectionFormDialog', () => {
  it('recommends a read-only login and masks the connection string', async () => {
    const { root, input } = await render();
    expect(root().textContent).toContain('Use a read-only database login.');
    expect(input('connection-string').type).toBe('password');
  });

  it('requires a name and a connection string when adding', async () => {
    const { root, submit, saved, input } = await render();
    await submit();
    expect(saved).toEqual([]);
    expect(root().textContent).toContain('Enter a name');
    expect(root().textContent).toContain('Enter the connection string.');
    expect(input('connection-name').getAttribute('aria-invalid')).toBe('true');
  });

  it('emits the new connection', async () => {
    const { type, submit, saved } = await render();
    await type('connection-name', ' Sales DB ');
    await type('connection-string', MOCK_CONNECTION_STRING);
    await submit();
    expect(saved).toEqual([{ name: 'Sales DB', connectionString: MOCK_CONNECTION_STRING }]);
  });

  it('never pre-fills the stored connection string when editing and keeps it when left empty', async () => {
    const { input, type, submit, saved } = await render(mockConnection());
    expect(input('connection-name').value).toBe('Sales DB');
    expect(input('connection-string').value).toBe('');
    await type('connection-name', 'Sales');
    await submit();
    expect(saved).toEqual([{ name: 'Sales' }]);
  });

  it('clears a typed secret when the dialog closes', async () => {
    const { fixture, type } = await render();
    await type('connection-string', MOCK_CONNECTION_STRING);
    fixture.componentRef.setInput('visible', false);
    await fixture.whenStable();
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    expect(document.body.querySelector<HTMLInputElement>('#connection-string')?.value).toBe('');
  });
});
