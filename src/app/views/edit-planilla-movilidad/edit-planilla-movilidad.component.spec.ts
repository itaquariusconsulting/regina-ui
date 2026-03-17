import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPlanillaMovilidadComponent } from './edit-planilla-movilidad.component';

describe('EditPlanillaMovilidadComponent', () => {
  let component: EditPlanillaMovilidadComponent;
  let fixture: ComponentFixture<EditPlanillaMovilidadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPlanillaMovilidadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditPlanillaMovilidadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
