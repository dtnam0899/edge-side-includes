import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Shell } from './shell';

describe('Shell', () => {
  it('renders the primary navigation and a main landmark', async () => {
    await TestBed.configureTestingModule({ imports: [Shell], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('nav[aria-label="Primary"] a')?.textContent?.trim()).toBe('AI assistant');
    expect(el.querySelector('main#main')).not.toBeNull();
  });
});
