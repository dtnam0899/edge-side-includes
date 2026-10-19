import { Routes } from '@angular/router';

import { SIGNED_OUT_PATH, authGuard } from './core/auth';

// Each feature module is lazy-loaded and exposes only its `<feature>.routes.ts` to the shell.
// Every feature route is behind `authGuard`; only the signed-out page is open.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'assistant' },
  {
    path: SIGNED_OUT_PATH.slice(1),
    loadComponent: () => import('./core/auth/signed-out-page/signed-out-page').then((m) => m.SignedOutPage),
    title: 'Signed out',
  },
  {
    path: 'assistant',
    canActivate: [authGuard],
    loadChildren: () => import('./features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
  },
  { path: '**', redirectTo: 'assistant' },
];
