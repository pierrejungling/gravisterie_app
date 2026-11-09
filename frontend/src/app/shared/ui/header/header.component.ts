import { Component, inject, computed, signal, effect, ViewChild, ElementRef, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AppRoutes, AppNode, ThemeService } from '@shared';
import { TokenService, ApiService, ApiURI, AuthSessionService, RealtimeService } from '@api';
import { filter, debounceTime, distinctUntilChanged, switchMap, catchError, map, finalize } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Commande, StatutCommande } from '../../../dashboard/feature/commande/model/commande.interface';
import { SafeSvgPipe } from './safe-svg.pipe';
import { OngletsCommandesComponent } from '../../../dashboard/feature/commande/component/onglets-commandes/onglets-commandes.component';
import { CommandeOngletsService } from '../../../dashboard/feature/commande/service/commande-onglets.service';

interface NavItem {
  label: string;
  path: string[];
  match: string;
  exact?: boolean;
  icon: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, SafeSvgPipe, OngletsCommandesComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  logoLoaded = false;
  logoError = false;
  private readonly tokenService: TokenService = inject(TokenService);
  private readonly authSession: AuthSessionService = inject(AuthSessionService);
  private readonly apiService: ApiService = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly themeService: ThemeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ongletsCommandes = inject(CommandeOngletsService);
  private readonly searchInput$ = new Subject<string>();
  private readonly searchMinLength = 2;
  private readonly searchMaxResults = 8;
  
  /** Entrées du menu (ordinateur : menu latéral ; téléphone : barre du bas + « Plus »). */
  readonly navItems: NavItem[] = [
    {
      label: 'Accueil',
      path: ['/dashboard'],
      match: '/dashboard',
      exact: true,
      icon: '<path d="M3 20 9.5 9l3.5 5 2.5-3.5L21 20z"/><path d="M12 3v4" stroke-dasharray="1.5 1.5"/>',
    },
    {
      label: 'En cours',
      path: ['/dashboard', 'commandes', 'en-cours'],
      match: '/dashboard/commandes/en-cours',
      icon: '<rect x="3" y="4" width="7" height="16"/><rect x="14" y="4" width="7" height="10"/>',
    },
    {
      label: 'Terminées',
      path: ['/dashboard', 'commandes', 'terminees'],
      match: '/dashboard/commandes/terminees',
      icon: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    },
    {
      label: 'Nouvelle',
      path: ['/dashboard', 'commandes', 'nouvelle'],
      match: '/dashboard/commandes/nouvelle',
      icon: '<path d="M12 5v14M5 12h14"/>',
    },
    {
      label: 'Clients',
      path: ['/dashboard', 'clients'],
      match: '/dashboard/clients',
      icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.4M18 14c1.9.8 3 2.9 3 6"/>',
    },
    {
      label: 'Bons',
      path: ['/dashboard', 'bons'],
      match: '/dashboard/bons',
      icon: '<rect x="3" y="7" width="18" height="12"/><path d="M12 7v12M3 12h18"/>',
    },
  ];

  /** Téléphone : « Clients » dans la barre du bas, le reste dans « Plus » (sauf Nouvelle, déjà le bouton +). */
  readonly clientsItem = this.navItems.find((item) => item.match === '/dashboard/clients')!;
  readonly moreItems = this.navItems.filter((item) => ['/dashboard/commandes/terminees', '/dashboard/bons'].includes(item.match));

  readonly iconSettings = '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>';
  readonly iconLogout = '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h11"/>';

  readonly todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  readonly shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
  moreOpen = signal<boolean>(false);

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
  searchOpen = signal<boolean>(false);
  searchResults = signal<Commande[]>([]);

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
  
  constructor(private router: Router) {
    // Écouter les changements de route
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute.set(event.url);
      });
    
    // Initialiser avec la route actuelle
    this.currentRoute.set(this.router.url);

    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmed = query.trim();
          if (trimmed.length < this.searchMinLength) {
            this.searchLoading.set(false);
            this.searchResults.set([]);
            return of([] as Commande[]);
          }

          this.searchLoading.set(true);
          return this.apiService.getWithQuery(ApiURI.RECHERCHE_COMMANDES, {
            q: trimmed,
            limit: this.searchMaxResults,
          }).pipe(
            map((response) => (response.result && response.data ? response.data as Commande[] : [])),
            catchError((error) => {
              console.error('Erreur lors de la recherche de commandes:', error);
              return of([] as Commande[]);
            }),
            finalize(() => this.searchLoading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((results) => this.searchResults.set(results));

    this.realtime.on('commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshOpenSearch());

    // Réinitialiser le fallback quand le thème change
    effect(() => {
      this.themeService.theme(); // S'abonner aux changements de thème
      this.fallbackLogoPath.set(''); // Réinitialiser le fallback
      this.logoLoaded = false; // Forcer le rechargement du logo
    });

    // Décale le contenu des pages pour laisser la place au menu
    effect(() => {
      document.body.classList.toggle('gv-shell', this.isAuthenticated());
      // Hauteur de la barre d'onglets des commandes : décale le contenu quand elle est affichée.
      const onglets = this.isAuthenticated() && this.ongletsCommandes.visible();
      document.body.classList.toggle('gv-has-tabs', onglets);
    });
  }

  /** Ctrl+K / Cmd+K : ouvre la recherche de commande. Échap : ferme. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      if (!this.showSearchBar()) return;
      event.preventDefault();
      if (!this.searchOpen()) {
        this.toggleSearch();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (this.searchOpen()) this.toggleSearch();
      if (this.moreOpen()) this.moreOpen.set(false);
    }
  }

  isNavActive(item: NavItem): boolean {
    const route = this.normalizeRoute(this.currentRoute());
    if (item.exact) {
      return route === item.match || route === `${item.match}/`;
    }
    // Le détail d'une commande reste rattaché à « En cours »
    if (item.match === '/dashboard/commandes/en-cours' && route.startsWith('/dashboard/commandes/detail/')) {
      return true;
    }
    return route.startsWith(item.match);
  }

  isSettingsActive(): boolean {
    return this.normalizeRoute(this.currentRoute()).startsWith('/dashboard/settings');
  }

  navigate(item: NavItem): void {
    this.router.navigate(item.path);
  }

  goToNouvelleCommande(): void {
    this.router.navigate(['/dashboard', 'commandes', 'nouvelle']);
  }

  toggleMore(): void {
    this.moreOpen.set(!this.moreOpen());
  }
  
  logout(): void {
    this.authSession.clearPersistedRoutes();
    this.tokenService.setToken({ token: '', refreshToken: '', isEmpty: true });
    localStorage.removeItem('currentUser');

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
    this.searchInput$.next(value);
  }

  private refreshOpenSearch(): void {
    const trimmed = this.searchQuery().trim();
    if (!this.searchOpen() || trimmed.length < this.searchMinLength) {
      return;
    }
    this.searchLoading.set(true);
    this.apiService.getWithQuery(ApiURI.RECHERCHE_COMMANDES, {
      q: trimmed,
      limit: this.searchMaxResults,
    }).subscribe({
      next: (response) => {
        this.searchResults.set(response.result && response.data ? response.data as Commande[] : []);
        this.searchLoading.set(false);
      },
      error: () => this.searchLoading.set(false),
    });
  }

  onSearchFocus(): void {
    this.searchFocused.set(true);
    const query = this.searchQuery().trim();
    if (query.length >= this.searchMinLength) {
      this.searchInput$.next(query);
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused.set(false);
    }, 150);
  }

  onSearchEnter(event: Event): void {
    event.preventDefault();
    const results = this.searchResults();
    if (results.length > 0) {
      this.onSelectCommande(results[0]);
    }
  }

  onSelectCommande(commande: Commande): void {
    this.searchFocused.set(false);
    this.searchOpen.set(false);
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande]);
  }

  toggleSearch(): void {
    const nextState = !this.searchOpen();
    this.searchOpen.set(nextState);
    if (nextState) {
      this.onSearchFocus();
      this.focusSearchInput();
      return;
    }
    this.searchQuery.set('');
    this.searchResults.set([]);
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
