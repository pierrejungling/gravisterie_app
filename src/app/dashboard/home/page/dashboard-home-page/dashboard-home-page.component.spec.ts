import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardHomePageComponent } from './dashboard-home-page.component';

describe('DashboardHomePageComponent', () => {
  let component: DashboardHomePageComponent;
  let fixture: ComponentFixture<DashboardHomePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHomePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardHomePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
