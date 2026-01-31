import { TestBed } from '@angular/core/testing';

import { ReginaIaService } from './regina-ia.service';

describe('ReginaIaService', () => {
  let service: ReginaIaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReginaIaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
