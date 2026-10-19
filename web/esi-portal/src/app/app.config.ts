import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';

import { authInterceptors, provideAuth } from './core/auth';
import { APP_CONFIG, AppConfig } from './core/config/app-config';
import { routes } from './app.routes';

export function createAppConfig(config: AppConfig): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withFetch(), withInterceptors(authInterceptors(config))),
      providePrimeNG({ theme: { preset: Aura } }),
      { provide: APP_CONFIG, useValue: config },
      ...provideAuth(config),
    ],
  };
}
