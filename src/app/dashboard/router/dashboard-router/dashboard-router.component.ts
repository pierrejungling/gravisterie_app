import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-dashboard-router',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-router.component.html',
  styleUrl: './dashboard-router.component.scss'
})
export class DashboardRouterComponent {
  protected readonly detailExampleId = 'mon-detail-id';
  protected readonly routes = AppRoutes;

  protected detailLink(id: string): string {
    return `${this.routes.MEMBER_DETAIL}${id}`;
  }
}
