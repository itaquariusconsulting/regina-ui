import { TestBed } from '@angular/core/testing';

import { OrdenPagoDetProvService } from './orden-pago-det-prov.service';

describe('OrdenPagoDetProvService', () => {
  let service: OrdenPagoDetProvService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrdenPagoDetProvService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
