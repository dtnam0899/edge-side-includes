import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Message } from 'primeng/message';

/** The recommendation to connect with a read-only database login (defense in depth next to statement validation). */
@Component({
  selector: 'app-read-only-login-notice',
  imports: [Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-message severity="info" styleClass="notice">
      <span>
        <strong>Use a read-only database login.</strong>
        The assistant only runs single SELECT statements, but a login that can only read (for
        example a member of
        <code>db_datareader</code>) also protects your data if a statement is ever misjudged.
      </span>
    </p-message>
  `,
})
export class ReadOnlyLoginNotice {}
