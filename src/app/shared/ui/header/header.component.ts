import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AppRoutes, AppNode } from '@shared';
import { TokenService } from '@api';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  logoLoaded = false;
  logoError = false;
  currentLogoPath = '';
  private readonly tokenService: TokenService = inject(TokenService);
  
  // Liste des fichiers logo possibles à essayer (ordre de priorité)
  private readonly possibleLogos = [
    // Logo principal spécifié par l'utilisateur
    'assets/images/Logo/La Gravisterie_N.svg',
    // Fallback vers autres formats
    'assets/images/Logo/La Gravisterie avec noir txt_N.svg',
    'assets/images/Logo/La Gravisterie carré_N.svg',
    'assets/images/Logo/logo_carre.png',
    'assets/images/Logo/La Gravisterie blanc carré.svg',
    'assets/images/Logo/La Gravisterie avec txt blanc sans fond copie.svg',
    'assets/images/Logo/La Gravisterie blanc sans fond copie.svg'
  ];
  
  // Signal computed pour l'authentification (réactif)
  isAuthenticated = computed(() => {
    const token = this.tokenService.token();
    return !token.isEmpty && token.token.trim().length > 0;
  });

  // Signal pour suivre la route actuelle
  currentRoute = signal<string>('');
  showBackButton = computed(() => {
    if (!this.isAuthenticated()) return false;
    const route = this.currentRoute();
    // Afficher le bouton retour si on n'est pas sur la page d'accueil du dashboard
    return route !== `/${AppNode.AUTHENTICATED}` && route !== `/${AppNode.AUTHENTICATED}/`;
  });
  
  constructor(private router: Router) {
    // Initialiser avec le logo principal
    this.currentLogoPath = this.possibleLogos[0];
    
    // Écouter les changements de route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute.set(event.url);
      });
    
    // Initialiser avec la route actuelle
    this.currentRoute.set(this.router.url);
  }
  
  logout(): void {
    // Nettoyer le token via le TokenService
    this.tokenService.setToken({ token: '', refreshToken: '', isEmpty: true });
    localStorage.removeItem('currentUser');
    
    // Rediriger vers la page de connexion
    this.router.navigate([AppRoutes.SIGN_IN]);
  }

  goToSettings(): void {
    this.router.navigate(['/dashboard/settings']);
  }

  goBack(): void {
    // Utiliser l'historique du navigateur pour revenir à la page précédente
    window.history.back();
  }

  goToDashboard(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED]);
  }
  
  private encodeLogoPath(path: string): string {
    // Encoder les espaces et caractères spéciaux dans l'URL
    return path.split('/').map(part => encodeURIComponent(part)).join('/');
  }
  
  getLogoPath(): string {
    return this.currentLogoPath;
  }
  
  onLogoLoad(): void {
    this.logoLoaded = true;
    this.logoError = false;
    console.log('Logo chargé avec succès:', this.currentLogoPath);
  }
  
  onLogoError(): void {
    // Trouver l'index du logo actuel
    const currentIndex = this.possibleLogos.indexOf(this.currentLogoPath);
    
    console.error('Erreur de chargement du logo:', this.currentLogoPath, 'Index:', currentIndex);
    
    // Essayer le logo suivant
    if (currentIndex < this.possibleLogos.length - 1) {
      // Essayer sans encodage d'abord
      this.currentLogoPath = this.possibleLogos[currentIndex + 1];
      this.logoLoaded = false;
      console.log('Essai du logo suivant (sans encodage):', this.currentLogoPath);
      // Angular détectera le changement de currentLogoPath et rechargera l'image
    } else if (!this.currentLogoPath.includes('%20')) {
      // Si tous les logos sans encodage ont échoué, essayer avec encodage
      console.log('Tentative avec encodage des espaces...');
      this.currentLogoPath = this.encodeLogoPath(this.possibleLogos[0]);
      this.logoLoaded = false;
    } else {
      // Tous les logos ont échoué
      this.logoError = true;
      this.logoLoaded = false;
      console.error('Tous les logos ont échoué à charger');
    }
  }
  
  showTextFallback(): boolean {
    return !this.logoLoaded && this.logoError;
  }
}
