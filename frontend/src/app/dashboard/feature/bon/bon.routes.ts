import { Routes } from '@angular/router';

export const bonRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./page/bons-cadeaux-page/bons-cadeaux-page.component').then(
        (c) => c.BonsCadeauxPageComponent,
      ),
  },
];

