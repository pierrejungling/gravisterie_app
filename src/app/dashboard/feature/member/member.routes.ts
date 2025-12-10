import { Routes } from '@angular/router';
import { AppNode } from '@shared';

export const memberRoutes: Routes = [
  {
    path: AppNode.DETAIL,
    loadComponent: () =>
      import('./page/member-detail-page/member-detail-page.component').then(
        (c) => c.MemberDetailPageComponent,
      ),
  },
];

