import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DslRendererAngular } from './dsl-renderer-angular';

describe('DslRendererAngular', () => {
  let component: DslRendererAngular;
  let fixture: ComponentFixture<DslRendererAngular>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DslRendererAngular]
    }).compileComponents();

    fixture = TestBed.createComponent(DslRendererAngular);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
