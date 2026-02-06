import { Component, inject, computed, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AppRoutes, AppNode, ThemeService } from '@shared';
import { TokenService, ApiService, ApiURI } from '@api';
import { filter } from 'rxjs/operators';
import { Commande, StatutCommande } from '../../../dashboard/feature/commande/model/commande.interface';

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
  private readonly tokenService: TokenService = inject(TokenService);
  private readonly apiService: ApiService = inject(ApiService);
  private readonly themeService: ThemeService = inject(ThemeService);
  private readonly searchMinLength = 2;
  private readonly searchMaxResults = 8;
  
  // Signal pour le thème actuel
  isDarkMode = computed(() => this.themeService.isDarkMode());
  
  // Liste des fichiers logo possibles à essayer (ordre de priorité)
  private readonly possibleLogosLight = [
    // Logo principal spécifié par l'utilisateur (mode clair)
    'assets/images/Logo/La Gravisterie_N.svg',
    // Fallback vers autres formats
    'assets/images/Logo/La Gravisterie avec noir txt_N.svg',
    'assets/images/Logo/La Gravisterie carré_N.svg',
    'assets/images/Logo/logo_carre.png'
  ];

  private readonly possibleLogosDark = [
    // Logo blanc pour mode nuit
    'assets/images/Logo/La Gravisterie Blanc.svg',
    // Fallback vers autres formats blancs
    'assets/images/Logo/La Gravisterie blanc sans fond copie.svg',
    'assets/images/Logo/La Gravisterie blanc carré.svg',
    'assets/images/Logo/La Gravisterie avec txt blanc sans fond copie.svg'
  ];

  // Signal pour le logo de fallback (en cas d'erreur)
  private fallbackLogoPath = signal<string>('');

  // Computed signal pour le logo selon le thème
  logoPath = computed(() => {
    // Si un fallback a été défini, l'utiliser
    const fallback = this.fallbackLogoPath();
    if (fallback) {
      return fallback;
    }
    
    // Sinon, utiliser le logo selon le thème
    const isDark = this.themeService.isDarkMode();
    const possibleLogos = isDark ? this.possibleLogosDark : this.possibleLogosLight;
    return possibleLogos[0];
  });
  
  // Signal computed pour l'authentification (réactif)
  isAuthenticated = computed(() => {
    const token = this.tokenService.token();
    return !token.isEmpty && token.token.trim().length > 0;
  });

  // Signal pour suivre la route actuelle
  currentRoute = signal<string>('');
  searchQuery = signal<string>('');
  searchFocused = signal<boolean>(false);
  searchLoading = signal<boolean>(false);
  searchLoaded = signal<boolean>(false);
  searchOpen = signal<boolean>(false);
  allCommandes = signal<Commande[]>([]);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  showBackButton = computed(() => {
    if (!this.isAuthenticated()) return false;
    const route = this.currentRoute();
    // Afficher le bouton retour si on n'est pas sur la page d'accueil du dashboard
    return route !== `/${AppNode.AUTHENTICATED}` && route !== `/${AppNode.AUTHENTICATED}/`;
  });

  showSearchBar = computed(() => {
    if (!this.isAuthenticated()) return false;
    const route = this.normalizeRoute(this.currentRoute());
    return !route.startsWith(AppRoutes.PUBLIC);
  });

  showSearchResults = computed(() => {
    if (!this.searchOpen()) return false;
    return this.searchQuery().trim().length > 0 || this.searchLoading();
  });

  filteredCommandes = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (query.length < this.searchMinLength) return [];
    const data = this.allCommandes();
    return data
      .filter(cmd => this.getCommandeSearchText(cmd).includes(query))
      .slice(0, this.searchMaxResults);
  });
  
  constructor(private router: Router) {
    // Écouter les changements de route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute.set(event.url);
      });
    
    // Initialiser avec la route actuelle
    this.currentRoute.set(this.router.url);

    // Réinitialiser le fallback quand le thème change
    effect(() => {
      this.themeService.theme(); // S'abonner aux changements de thème
      this.fallbackLogoPath.set(''); // Réinitialiser le fallback
      this.logoLoaded = false; // Forcer le rechargement du logo
    });
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
    const route = this.normalizeRoute(this.currentRoute());

    // Nouvelle commande -> dashboard
    if (route.startsWith(AppRoutes.NOUVELLE_COMMANDE)) {
      this.router.navigate([AppRoutes.AUTHENTICATED]);
      return;
    }

    // Commandes en cours -> dashboard
    if (route.startsWith(AppRoutes.COMMANDES_EN_COURS)) {
      this.router.navigate([AppRoutes.AUTHENTICATED]);
      return;
    }

    // Commandes terminées/annulées -> dashboard
    if (route.startsWith(`/${AppNode.AUTHENTICATED}/${AppNode.COMMANDES}/${AppNode.COMMANDES_TERMINEES}`)) {
      this.router.navigate([AppRoutes.AUTHENTICATED]);
      return;
    }

    // Détail commande -> retour selon provenance
    if (route.startsWith(`/${AppNode.AUTHENTICATED}/${AppNode.COMMANDES}/detail/`)) {
      try {
        const returnPage = sessionStorage.getItem('detail-return-page');
        if (returnPage === 'terminees') {
          this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'terminees']);
          return;
        }
      } catch {
        // ignorer
      }
      this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'en-cours']);
      return;
    }

    // Par défaut, utiliser l'historique du navigateur
    window.history.back();
  }

  goToDashboard(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED]);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    if (value.trim().length >= this.searchMinLength) {
      this.ensureCommandesLoaded();
    }
  }

  onSearchFocus(): void {
    this.searchFocused.set(true);
    if (this.searchQuery().trim().length >= this.searchMinLength) {
      this.ensureCommandesLoaded();
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused.set(false);
    }, 150);
  }

  onSearchEnter(event: Event): void {
    event.preventDefault();
    const results = this.filteredCommandes();
    if (results.length > 0) {
      this.onSelectCommande(results[0]);
    }
  }

  onSelectCommande(commande: Commande): void {
    this.searchFocused.set(false);
    this.searchOpen.set(false);
    this.searchQuery.set('');
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande]);
  }

  toggleSearch(): void {
    const nextState = !this.searchOpen();
    this.searchOpen.set(nextState);
    if (nextState) {
      this.onSearchFocus();
      this.focusSearchInput();
    }
  }

  private focusSearchInput(attempt: number = 0): void {
    const input = this.searchInput?.nativeElement;
    if (input) {
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      return;
    }
    if (attempt < 5) {
      setTimeout(() => this.focusSearchInput(attempt + 1), 50);
    }
  }

  getCommandeTitle(commande: Commande): string {
    return (
      commande.produit ||
      commande.description ||
      commande.personnalisation?.texte ||
      'Commande sans intitulé'
    );
  }

  getCommandeMeta(commande: Commande): string {
    const clientName = this.getClientName(commande.client);
    const statusLabel = this.getCommandeStatusLabel(commande);
    return `${clientName} • ${statusLabel}`;
  }

  getCommandeClientLabel(commande: Commande): string {
    return this.getClientName(commande.client);
  }

  getCommandeDateLabel(commande: Commande): string {
    if (!commande.date_commande) return 'Date inconnue';
    const date = new Date(commande.date_commande);
    if (Number.isNaN(date.getTime())) return 'Date inconnue';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getCommandePriceLabel(commande: Commande): string | null {
    if (commande.prix_final === undefined || commande.prix_final === null) return null;
    return `${commande.prix_final} €`;
  }

  getCommandeStatusLabel(commande: Commande): string {
    if (commande.statut_commande === StatutCommande.TERMINE) return 'Terminée';
    if (commande.statut_commande === StatutCommande.ANNULEE) return 'Annulée';
    return 'En cours';
  }

  getCommandeStatusClass(commande: Commande): string {
    if (commande.statut_commande === StatutCommande.TERMINE) return 'status--terminee';
    if (commande.statut_commande === StatutCommande.ANNULEE) return 'status--annulee';
    return 'status--en-cours';
  }

  private getClientName(client: Commande['client']): string {
    const societe = client?.société || '';
    const nom = client?.nom || '';
    const prenom = client?.prénom || '';
    const fullName = `${nom} ${prenom}`.trim();
    if (societe && fullName) return `${societe} — ${fullName}`;
    if (societe) return societe;
    if (fullName) return fullName;
    return client?.mail || client?.téléphone || 'Client inconnu';
  }

  private getCommandeSearchText(commande: Commande): string {
    const client = commande.client;
    return [
      commande.id_commande,
      commande.produit,
      commande.description,
      commande.personnalisation?.texte,
      client?.nom,
      client?.prénom,
      client?.société,
      client?.mail,
      client?.téléphone,
      client?.tva,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private ensureCommandesLoaded(): void {
    if (this.searchLoaded() || this.searchLoading()) return;
    this.searchLoading.set(true);
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.allCommandes.set(response.data as Commande[]);
          this.searchLoaded.set(true);
        }
        this.searchLoading.set(false);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des commandes:', error);
        this.searchLoading.set(false);
      }
    });
  }
  
  private encodeLogoPath(path: string): string {
    // Encoder les espaces et caractères spéciaux dans l'URL
    return path.split('/').map(part => encodeURIComponent(part)).join('/');
  }
  
  onLogoLoad(): void {
    this.logoLoaded = true;
    this.logoError = false;
    // Réinitialiser le fallback quand le logo charge avec succès
    this.fallbackLogoPath.set('');
    console.log('Logo chargé avec succès:', this.logoPath());
  }
  
  onLogoError(): void {
    const isDark = this.themeService.isDarkMode();
    const possibleLogos = isDark ? this.possibleLogosDark : this.possibleLogosLight;
    const currentPath = this.logoPath();
    
    // Trouver l'index du logo actuel dans la liste appropriée
    const currentIndex = possibleLogos.indexOf(currentPath);
    
    console.error('Erreur de chargement du logo:', currentPath, 'Index:', currentIndex);
    
    // Essayer le logo suivant
    if (currentIndex < possibleLogos.length - 1 && currentIndex >= 0) {
      // Essayer sans encodage d'abord
      const nextLogo = possibleLogos[currentIndex + 1];
      this.fallbackLogoPath.set(nextLogo);
      this.logoLoaded = false;
      console.log('Essai du logo suivant (sans encodage):', nextLogo);
    } else if (currentIndex === -1 && !currentPath.includes('%20')) {
      // Le logo actuel n'est pas dans la liste, essayer avec encodage
      console.log('Tentative avec encodage des espaces...');
      const encodedLogo = this.encodeLogoPath(possibleLogos[0]);
      this.fallbackLogoPath.set(encodedLogo);
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

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  private normalizeRoute(route: string): string {
    return route.split('?')[0].split('#')[0];
  }
}
