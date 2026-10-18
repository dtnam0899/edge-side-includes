import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { filter, map, startWith } from 'rxjs';

import { ConnectionFormDialog } from '../../components/connection-form-dialog/connection-form-dialog';
import { ConnectionList } from '../../components/connection-list/connection-list';
import { ConsentTermsDialog } from '../../components/consent-terms-dialog/consent-terms-dialog';
import { ConnectionEditorService } from '../../services/connection-editor.service';
import { ConnectionsService } from '../../services/connections.service';
import { ConsentService } from '../../services/consent.service';

/** Assistant shell: the connection list beside the selected connection, plus the consent and connection dialogs. */
@Component({
  selector: 'app-assistant-page',
  imports: [
    RouterOutlet,
    ButtonDirective,
    ConfirmDialog,
    Message,
    ConnectionFormDialog,
    ConnectionList,
    ConsentTermsDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './assistant-page.html',
  styleUrl: './assistant-page.scss',
})
export class AssistantPage {
  protected readonly consent = inject(ConsentService);
  protected readonly connections = inject(ConnectionsService);
  protected readonly editor = inject(ConnectionEditorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Id of the connection shown in the outlet, for highlighting it in the list. */
  protected readonly selectedId = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.firstChild?.snapshot?.paramMap.get('connectionId') ?? null),
    ),
    { initialValue: null },
  );

  protected readonly showOutdatedBanner = computed(
    () => this.consent.isOutdated() && !this.consent.dialogOpen(),
  );

  constructor() {
    this.consent.load();
    this.connections.load();
  }

  protected reviewTerms(): void {
    this.consent.ensureAccepted().subscribe();
  }
}
