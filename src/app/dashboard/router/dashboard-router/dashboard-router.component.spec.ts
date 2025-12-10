import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardRouterComponent } from './dashboard-router.component';

describe('DashboardRouterComponent', () => {
  let component: DashboardRouterComponent;
  let fixture: ComponentFixture<DashboardRouterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardRouterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardRouterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
