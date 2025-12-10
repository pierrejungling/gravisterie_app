import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityFallBackPageComponent } from './security-fall-back-page.component';

describe('SecurityFallBackPageComponent', () => {
  let component: SecurityFallBackPageComponent;
  let fixture: ComponentFixture<SecurityFallBackPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityFallBackPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SecurityFallBackPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
