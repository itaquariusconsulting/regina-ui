import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListOrdenPagoComponent } from './list-orden-pago.component';

describe('ListOrdenPagoComponent', () => {
  let component: ListOrdenPagoComponent;
  let fixture: ComponentFixture<ListOrdenPagoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListOrdenPagoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListOrdenPagoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
