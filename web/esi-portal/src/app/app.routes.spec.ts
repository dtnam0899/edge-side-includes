import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { provideCoreApiTesting } from '../testing/core-api-testing';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...provideCoreApiTesting()],
    }),
  );

  it('lazy-loads the assistant module', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/assistant');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('AI assistant');
  });

  it('redirects unknown URLs to the assistant', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/does-not-exist');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('AI assistant');
  });
});
