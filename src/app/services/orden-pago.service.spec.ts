import { TestBed } from '@angular/core/testing';

import { OrdenPagoService } from './orden-pago.service';

describe('OrdenPagoService', () => {
  let service: OrdenPagoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdenPagoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
