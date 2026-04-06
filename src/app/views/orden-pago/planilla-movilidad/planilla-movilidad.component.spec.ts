import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlanillaMovilidadComponent } from './planilla-movilidad.component';

describe('PlanillaMovilidadComponent', () => {
  let component: PlanillaMovilidadComponent;
  let fixture: ComponentFixture<PlanillaMovilidadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanillaMovilidadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlanillaMovilidadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
