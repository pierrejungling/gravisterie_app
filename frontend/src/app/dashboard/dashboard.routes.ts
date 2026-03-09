import { Routes } from '@angular/router';
import { AppNode } from '@shared';

export const DashboardRoutes: Routes = [
    {
    path: '',
    loadComponent: () => import('./router/dashboard-router/dashboard-router.component')
    .then(c => c.DashboardRouterComponent),
    children: [
            {
                path: '',
                loadComponent: () => import('./home/page/dashboard-home-page/dashboard-home-page.component')
                .then(c => c.DashboardHomePageComponent),
            },
            {
                path: AppNode.MEMBER,
                loadChildren: () => import('./feature/member/member.routes').then(r => r.memberRoutes)
            },
            {
                path: 'settings',
                loadComponent: () => import('./settings/page/settings-page/settings-page.component')
                .then(c => c.SettingsPageComponent),
            },
            {
                path: AppNode.COMMANDES,
                loadChildren: () => import('./feature/commande/commande.routes').then(r => r.commandeRoutes)
            },
            {
                path: AppNode.BONS,
                loadChildren: () => import('./feature/bon/bon.routes').then(r => r.bonRoutes)
            }
        ]
    }
]