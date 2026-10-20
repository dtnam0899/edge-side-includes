import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';

import { AuthSession } from '../auth';

/**
 * App shell: header, primary navigation, the signed-in user with sign-out, and the outlet lazy feature modules
 * render into. Signed-out users only see the signed-out page (every other route sends them to Auth0), which
 * carries the sign-in button.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly navItems = [{ path: '/assistant', label: 'AI assistant' }] as const;
  protected readonly session = inject(AuthSession);
}
