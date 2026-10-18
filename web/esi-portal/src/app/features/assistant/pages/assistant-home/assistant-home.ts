import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import { ReadOnlyLoginNotice } from '../../components/read-only-login-notice/read-only-login-notice';
import { ConnectionEditorService } from '../../services/connection-editor.service';
import { ConnectionsService } from '../../services/connections.service';

/** Start screen of the assistant when no connection is selected. */
@Component({
  selector: 'app-assistant-home',
  imports: [ButtonDirective, ReadOnlyLoginNotice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home">
      @if (connections.loaded() && !connections.connections().length) {
        <h2>Connect a SQL Server database</h2>
        <p>
          Ask questions in plain language and the assistant writes SQL for you to review. Nothing
          runs until you choose to, and only single read-only SELECT statements can run.
        </p>
        <app-read-only-login-notice />
        <div>
          <button pButton type="button" (click)="editor.openCreate()">
            Add your first connection
          </button>
        </div>
      } @else {
        <h2>Select a database</h2>
        <p>Choose a connection to see its chats and saved scripts, or add a new one.</p>
      }
    </div>
  `,
  styles: `
    .home {
      max-width: 40rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h2 {
      margin: 0;
      font-size: 1.375rem;
    }
    p {
      margin: 0;
      line-height: 1.5;
    }
  `,
})
export class AssistantHome {
  protected readonly connections = inject(ConnectionsService);
  protected readonly editor = inject(ConnectionEditorService);
}
