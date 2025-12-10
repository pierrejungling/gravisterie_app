import { inject } from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';
import { TokenService } from '@api';
import { AppNode } from '@shared';

export function DashboardGuard(): CanActivateFn {
    return () => {
        const tokenService: TokenService = inject(TokenService);
        const router: Router = inject(Router);
        
        // Vérifier l'authentification via le TokenService
        const token = tokenService.token();
        
        if (!token.isEmpty && token.token.trim().length > 0) {
            return true;
        } else {
            // Rediriger vers la page de connexion si non authentifié
            return router.createUrlTree([AppNode.PUBLIC]);
        }
    };
    }