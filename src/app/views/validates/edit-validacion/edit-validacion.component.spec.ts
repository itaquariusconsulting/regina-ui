import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditValidacionComponent } from './edit-validacion.component';

describe('EditValidacionComponent', () => {
  let component: EditValidacionComponent;
  let fixture: ComponentFixture<EditValidacionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditValidacionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditValidacionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
