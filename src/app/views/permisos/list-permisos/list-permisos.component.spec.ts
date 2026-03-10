import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListPermisosComponent } from './list-permisos.component';

describe('ListPermisosComponent', () => {
  let component: ListPermisosComponent;
  let fixture: ComponentFixture<ListPermisosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPermisosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListPermisosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
