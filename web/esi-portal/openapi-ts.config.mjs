// Generator settings for the core-api client. Run `npm run generate:api` (scripts/generate-api.mjs), which
// supplies the input from the pinned contract package; never edit the output by hand. Temporary home until
// lib/api-client is published.
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  output: { path: 'src/app/core/api/generated', postProcess: ['prettier'] },
  plugins: [
    { name: '@hey-api/client-angular', baseUrl: false },
    '@hey-api/typescript',
    '@hey-api/sdk',
    { name: '@angular/common', httpRequests: true, httpResources: false },
  ],
});
