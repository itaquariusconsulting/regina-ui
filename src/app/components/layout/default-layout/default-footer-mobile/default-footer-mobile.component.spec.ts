import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DefaultFooterMobileComponent } from './default-footer-mobile.component';

describe('DefaultFooterMobileComponent', () => {
  let component: DefaultFooterMobileComponent;
  let fixture: ComponentFixture<DefaultFooterMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DefaultFooterMobileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DefaultFooterMobileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
