import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NuevoValidacionComponent } from './nuevo-validacion.component';

describe('EditValidacionComponent', () => {
  let component: NuevoValidacionComponent;
  let fixture: ComponentFixture<NuevoValidacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuevoValidacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NuevoValidacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
