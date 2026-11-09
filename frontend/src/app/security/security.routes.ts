import { Routes } from "@angular/router";
import { AppNode } from "@shared";

export const securityRoutes: Routes = [
    {
        path: '',
        redirectTo: AppNode.SIGN_IN,
        pathMatch: 'full'
    },

    {
        path: AppNode.SIGN_IN,
        loadComponent: () =>
        import('./page/sign-in-page/sign-in-page.component').then(c => c.SignInPageComponent),
    },

    {
        path: AppNode.FALL_BACK,
        loadComponent: () =>
        import('./page/security-fall-back-page/security-fall-back-page.component').then(c => c.SecurityFallBackPageComponent)
    },
    


]