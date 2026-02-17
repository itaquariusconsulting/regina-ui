import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListValidacionesComponent } from './list-validaciones.component';

describe('ListValidacionesComponent', () => {
  let component: ListValidacionesComponent;
  let fixture: ComponentFixture<ListValidacionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListValidacionesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListValidacionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
