import { bootstrapApplication } from '@angular/platform-browser';

import { createAppConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';
import { Shell } from './app/core/layout/shell';

loadAppConfig()
  .then((config) => bootstrapApplication(Shell, createAppConfig(config)))
  .catch((err: unknown) => console.error(err));
