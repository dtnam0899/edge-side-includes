import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder page; chat and connections arrive with ESI-19, DSL rendering with ESI-20. */
@Component({
  selector: 'app-assistant-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>AI assistant</h1>
    <p>The assistant module is scaffolded. Chat and database connections are added by ESI-19.</p>
  `,
})
export class AssistantPage {}
