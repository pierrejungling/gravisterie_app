import { Routes } from '@angular/router';
import { AppNode } from '@shared';

export const commandeRoutes: Routes = [
    {
        path: '',
        redirectTo: AppNode.COMMANDES_EN_COURS,
        pathMatch: 'full'
    },
    {
        path: AppNode.NOUVELLE_COMMANDE,
        loadComponent: () => import('./page/nouvelle-commande-page/nouvelle-commande-page.component')
            .then(c => c.NouvelleCommandePageComponent),
    },
    {
        path: AppNode.COMMANDES_EN_COURS,
        loadComponent: () => import('./page/commandes-en-cours-page/commandes-en-cours-page.component')
            .then(c => c.CommandesEnCoursPageComponent),
    },
    {
        path: AppNode.COMMANDES_TERMINEES,
        loadComponent: () => import('./page/commandes-terminees-page/commandes-terminees-page.component')
            .then(c => c.CommandesTermineesPageComponent),
    },
    {
        path: AppNode.DETAIL_COMMANDE,
        loadComponent: () => import('./page/detail-commande-page/detail-commande-page.component')
            .then(c => c.DetailCommandePageComponent),
    }
];
