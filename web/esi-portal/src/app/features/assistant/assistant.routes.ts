import { Routes } from '@angular/router';
import { ConfirmationService } from 'primeng/api';

import { ConnectionEditorService } from './services/connection-editor.service';
import { ConnectionsService } from './services/connections.service';
import { ConsentService } from './services/consent.service';

/** Public API of the assistant module: only its routes. Everything else in this folder is private. */
export const ASSISTANT_ROUTES: Routes = [
  {
    path: '',
    title: 'AI assistant',
    providers: [ConsentService, ConnectionsService, ConnectionEditorService, ConfirmationService],
    loadComponent: () =>
      import('./pages/assistant-page/assistant-page').then((m) => m.AssistantPage),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/assistant-home/assistant-home').then((m) => m.AssistantHome),
      },
      {
        path: 'connections/:connectionId',
        title: 'Database – AI assistant',
        loadComponent: () =>
          import('./pages/connection-workspace/connection-workspace').then(
            (m) => m.ConnectionWorkspace,
          ),
      },
    ],
  },
];
