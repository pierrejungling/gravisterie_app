import { Routes } from '@angular/router';

export const siteRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./page/site-page/site-page.component').then((c) => c.SitePageComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./page/site-detail-page/site-detail-page.component').then((c) => c.SiteDetailPageComponent),
    // Changements non enregistrés : on demande avant de quitter la fiche
    canDeactivate: [(page: { peutQuitter?: () => boolean }) => page?.peutQuitter?.() ?? true],
  },
];
