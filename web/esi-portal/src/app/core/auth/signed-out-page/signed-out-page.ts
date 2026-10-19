import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';

import { AuthSession } from '../auth-session';

/** Unguarded page after sign-out, and where a failed sign-in lands with the reason. */
@Component({
  selector: 'app-signed-out-page',
  imports: [RouterLink, ButtonDirective, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="signed-out">
      @if (!session.enabled) {
        <h1>Sign-in is off</h1>
        <p>This environment has no sign-in configured, so the portal is open.</p>
        <div><a pButton routerLink="/">Open the portal</a></div>
      } @else if (session.user()) {
        <h1>You are signed in</h1>
        <div><a pButton routerLink="/">Open the portal</a></div>
      } @else {
        @if (session.error(); as error) {
          <h1>Sign-in failed</h1>
          <p-message severity="error">
            <span>{{ error }}</span>
          </p-message>
          <p>If you should have access, ask the portal owner for an invitation, then sign in again.</p>
        } @else {
          <h1>You are signed out</h1>
          <p>ESI Portal is invite-only. Sign in with the account you were invited with.</p>
        }
        <div>
          <button pButton type="button" (click)="session.signIn()">Sign in</button>
        </div>
      }
    </div>
  `,
  styles: `
    .signed-out {
      max-width: 40rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      line-height: 1.5;
    }
  `,
})
export class SignedOutPage {
  protected readonly session = inject(AuthSession);
}
