import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { filter, finalize, switchMap } from 'rxjs';

import { ApiProblem, Connection, toApiProblem } from '../../../../core/api';
import {
  ConnectionHeader,
  ConnectionTestState,
} from '../../components/connection-header/connection-header';
import { ChatPanel } from '../../containers/chat-panel/chat-panel';
import { ScriptsPanel } from '../../containers/scripts-panel/scripts-panel';
import { needsTermsAcceptance } from '../../helpers/problem-message';
import { ConnectionEditorService } from '../../services/connection-editor.service';
import { ConnectionsService } from '../../services/connections.service';
import { ConsentService } from '../../services/consent.service';

type WorkspaceTab = 'chat' | 'scripts';

/**
 * A selected connection. With consent granted it shows chats and saved scripts; with consent withdrawn nothing of
 * the connection's data is loaded or shown until consent is granted again.
 */
@Component({
  selector: 'app-connection-workspace',
  imports: [
    RouterLink,
    ButtonDirective,
    Skeleton,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
    ConnectionHeader,
    ChatPanel,
    ScriptsPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './connection-workspace.html',
  styleUrl: './connection-workspace.scss',
})
export class ConnectionWorkspace {
  /** Route parameter. */
  readonly connectionId = input.required<string>();
  /** Query parameter `?session=`. */
  readonly session = input<string | undefined>(undefined);

  protected readonly connections = inject(ConnectionsService);
  private readonly consent = inject(ConsentService);
  private readonly editor = inject(ConnectionEditorService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly connection = computed(() =>
    this.connections.connections().find((c) => c.id === this.connectionId()),
  );
  protected readonly tab = signal<WorkspaceTab>('chat');
  protected readonly testState = signal<ConnectionTestState>({ status: 'idle' });
  protected readonly consentBusy = signal(false);
  protected readonly actionProblem = signal<ApiProblem | null>(null);

  constructor() {
    effect(() => {
      this.connectionId();
      untracked(() => {
        this.tab.set('chat');
        this.testState.set({ status: 'idle' });
        this.actionProblem.set(null);
      });
    });
  }

  protected selectTab(value: string | number | undefined): void {
    this.tab.set(value === 'scripts' ? 'scripts' : 'chat');
  }

  protected test(connection: Connection): void {
    this.testState.set({ status: 'testing' });
    this.connections
      .test(connection.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.testState.set({ status: 'success', result }),
        error: (error: unknown) =>
          this.testState.set({ status: 'failure', problem: this.read(error, connection) }),
      });
  }

  protected edit(connection: Connection): void {
    this.editor.openEdit(connection);
  }

  protected confirmWithdraw(connection: Connection): void {
    this.confirmation.confirm({
      header: 'Withdraw consent?',
      message: `The assistant stops using “${connection.name}” immediately: its chats, saved scripts and SQL execution are hidden. Nothing is deleted, and granting consent again restores access.`,
      acceptLabel: 'Withdraw consent',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'warn' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => this.withdraw(connection),
    });
  }

  protected grant(connection: Connection): void {
    this.actionProblem.set(null);
    this.consent
      .ensureAccepted()
      .pipe(
        filter((accepted) => accepted),
        switchMap(() => {
          this.consentBusy.set(true);
          return this.connections
            .grantConsent(connection.id)
            .pipe(finalize(() => this.consentBusy.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) => this.actionProblem.set(this.read(error, connection)),
      });
  }

  protected confirmDelete(connection: Connection): void {
    this.confirmation.confirm({
      header: 'Delete connection?',
      message: `“${connection.name}” and its stored connection string are deleted. Saved artifacts and dashboards that use it will report it as unavailable.`,
      acceptLabel: 'Delete connection',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.connections
          .delete(connection.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => void this.router.navigate(['/assistant']),
            error: (error: unknown) => this.actionProblem.set(this.read(error, connection)),
          }),
    });
  }

  private withdraw(connection: Connection): void {
    this.consentBusy.set(true);
    this.actionProblem.set(null);
    this.connections
      .withdrawConsent(connection.id)
      .pipe(
        finalize(() => this.consentBusy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () =>
          void this.router.navigate([], {
            queryParams: { session: null },
            queryParamsHandling: 'merge',
          }),
        error: (error: unknown) => this.actionProblem.set(this.read(error, connection)),
      });
  }

  private read(error: unknown, connection: Connection): ApiProblem {
    const problem = toApiProblem(error);
    if (problem.name === 'consent-withdrawn') {
      this.connections.markWithdrawn(connection.id);
    } else if (needsTermsAcceptance(problem)) {
      this.consent.invalidate();
    }
    return problem;
  }
}
