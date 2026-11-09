import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard-router',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './dashboard-router.component.html',
  styleUrl: './dashboard-router.component.scss'
})
export class DashboardRouterComponent {}
