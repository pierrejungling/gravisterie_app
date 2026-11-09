import { Routes } from '@angular/router';
import { AppNode } from '@shared';

export const clientRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page/clients-page/clients-page.component').then((c) => c.ClientsPageComponent),
  },
  {
    path: AppNode.DETAIL_CLIENT,
    loadComponent: () =>
      import('./page/client-detail-page/client-detail-page.component').then((c) => c.ClientDetailPageComponent),
  },
];
