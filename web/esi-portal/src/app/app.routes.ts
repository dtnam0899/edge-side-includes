import { Routes } from '@angular/router';

// Each feature module is lazy-loaded and exposes only its `<feature>.routes.ts` to the shell.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'assistant' },
  {
    path: 'assistant',
    loadChildren: () => import('./features/assistant/assistant.routes').then((m) => m.ASSISTANT_ROUTES),
  },
  { path: '**', redirectTo: 'assistant' },
];
