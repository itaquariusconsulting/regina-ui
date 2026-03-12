import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewOrdenPagoComponent } from './view-orden-pago.component';

describe('ViewOrdenPagoComponent', () => {
  let component: ViewOrdenPagoComponent;
  let fixture: ComponentFixture<ViewOrdenPagoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewOrdenPagoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewOrdenPagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
