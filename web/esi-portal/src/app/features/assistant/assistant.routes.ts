import { Routes } from '@angular/router';

/** Public API of the assistant module: only its routes. Everything else in this folder is private. */
export const ASSISTANT_ROUTES: Routes = [
  {
    path: '',
    title: 'AI assistant',
    loadComponent: () => import('./pages/assistant-page/assistant-page').then((m) => m.AssistantPage),
  },
];
