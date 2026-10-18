import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MOCK_ID_2, mockChatSessionSummary } from '../../../../../testing/mocks/core-api.mocks';
import { SessionList } from './session-list';

describe('SessionList', () => {
  it('links each session and names one without a title', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(SessionList);
    fixture.componentRef.setInput('sessions', [mockChatSessionSummary({ title: '' })]);
    fixture.componentRef.setInput('activeId', MOCK_ID_2);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(link.querySelector('.title')?.textContent).toBe('Untitled chat');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('href')).toContain(`session=${MOCK_ID_2}`);
  });
});
