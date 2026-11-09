import { Routes } from '@angular/router';

export const evenementRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page/evenements-page/evenements-page.component').then((c) => c.EvenementsPageComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./page/evenement-detail-page/evenement-detail-page.component').then((c) => c.EvenementDetailPageComponent),
  },
];
