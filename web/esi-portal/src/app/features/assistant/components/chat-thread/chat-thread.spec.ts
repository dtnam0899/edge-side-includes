import { TestBed } from '@angular/core/testing';

import { mockAnswer, mockQuestion } from '../../../../../testing/mocks/core-api.mocks';
import { ChatThread } from './chat-thread';

describe('ChatThread', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(ChatThread);
    fixture.componentRef.setInput('messages', []);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the question in progress and announces it', async () => {
    const { el } = await render({ pendingQuestion: 'Total revenue' });
    expect(el.textContent).toContain('Generating SQL for your question');
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Generating an answer.',
    );
  });

  it('shows a failed question with a retry action', async () => {
    const { fixture, el } = await render({
      failedQuestion: {
        text: 'Total revenue',
        problem: { name: 'http-503', status: 503, title: 'Unavailable', issues: [], errors: [] },
      },
    });
    const retried: string[] = [];
    fixture.componentInstance.retry.subscribe((text) => retried.push(text));
    expect(el.textContent).toContain('No answer was generated.');
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Try again')?.click();
    expect(retried).toEqual(['Total revenue']);
  });

  it('renders the answer explanation and its SQL without any result before a run', async () => {
    const { el } = await render({ messages: [mockQuestion(), mockAnswer()] });
    expect(el.querySelectorAll('li')).toHaveLength(2);
    expect(el.querySelector('app-generated-sql')).not.toBeNull();
    expect(el.querySelector('app-query-result')).toBeNull();
  });
});
