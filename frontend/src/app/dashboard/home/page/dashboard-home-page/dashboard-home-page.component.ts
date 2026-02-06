import { Component, OnInit, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent, ThemeService } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { ApiResponse } from '@api';
import { Commande, StatutCommande } from '../../../feature/commande/model/commande.interface';

export interface DashboardCard {
  title: string;
  description: string;
  route: string;
  icon: string;
  count?: number;
  countTerminees?: number;
  countAnnulees?: number;
}

@Component({
  selector: 'app-dashboard-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './dashboard-home-page.component.html',
  styleUrl: './dashboard-home-page.component.scss'
})
export class DashboardHomePageComponent implements OnInit {
  logoError = false;
  currentUser: string = 'Utilisateur';
  private readonly apiService: ApiService = inject(ApiService);
  private readonly themeService: ThemeService = inject(ThemeService);

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
  
  dashboardCards: DashboardCard[] = [
    {
      title: 'Nouvelle commande / vente',
      description: 'Créer une nouvelle commande',
      route: '/dashboard/commandes/nouvelle',
      icon: '➕',
    },
    {
      title: 'Commandes en cours',
      description: 'Suivez l\'état de vos commandes en cours de traitement',
      route: '/dashboard/commandes/en-cours',
      icon: '📋',
      count: 0
    },
    {
      title: 'Commandes / ventes terminées ou annulées',
      description: 'Consultez vos commandes / ventes finalisées',
      route: '/dashboard/commandes/terminees',
      icon: '✅',
      countTerminees: 0,
      countAnnulees: 0
    },
  ];

  ngOnInit(): void {
    // Récupérer le nom d'utilisateur depuis localStorage (fallback)
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentUser = storedUser;
    }
    
    // Récupérer les informations de l'utilisateur depuis l'API
    this.apiService.get(ApiURI.ME).subscribe({
      next: (response: ApiResponse) => {
        if (response.result && response.data && response.data.username) {
          this.currentUser = response.data.username;
          // Mettre à jour localStorage avec le username de l'API
          localStorage.setItem('currentUser', response.data.username);
        }
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des informations utilisateur:', error);
        // En cas d'erreur, utiliser le nom stocké dans localStorage ou "Utilisateur"
        this.currentUser = storedUser || 'Utilisateur';
      }
    });

    // Charger les commandes pour mettre à jour les compteurs
    this.loadCommandesCount();

    // Réinitialiser le fallback quand le thème change
    effect(() => {
      this.themeService.theme(); // S'abonner aux changements de thème
      this.fallbackLogoPath.set(''); // Réinitialiser le fallback
    });
  }

  loadCommandesCount(): void {
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response: ApiResponse) => {
        if (response.result && response.data) {
          const commandes = response.data as Commande[];
          
          // Compter les commandes non terminées (excluant aussi les annulées)
          const commandesEnCours = commandes.filter(cmd => 
            cmd.statut_commande !== StatutCommande.TERMINE && cmd.statut_commande !== StatutCommande.ANNULEE
          ).length;

          // Compter séparément les commandes terminées et annulées
          const commandesTerminees = commandes.filter(cmd => 
            cmd.statut_commande === StatutCommande.TERMINE
          ).length;

          const commandesAnnulees = commandes.filter(cmd => 
            cmd.statut_commande === StatutCommande.ANNULEE
          ).length;

          // Mettre à jour le compteur de la carte "Commandes en cours"
          const commandesEnCoursCard = this.dashboardCards.find(card => card.route === '/dashboard/commandes/en-cours');
          if (commandesEnCoursCard) {
            commandesEnCoursCard.count = commandesEnCours;
          }

          // Mettre à jour les compteurs de la carte "Commandes et ventes terminées ou annulées"
          const commandesTermineesCard = this.dashboardCards.find(card => card.route === '/dashboard/commandes/terminees');
          if (commandesTermineesCard) {
            commandesTermineesCard.countTerminees = commandesTerminees;
            commandesTermineesCard.countAnnulees = commandesAnnulees;
          }
        }
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des commandes:', error);
      }
    });
  }

  onLogoLoad(): void {
    this.logoError = false;
    // Réinitialiser le fallback quand le logo charge avec succès
    this.fallbackLogoPath.set('');
    console.log('Logo chargé avec succès:', this.logoPath());
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      console.error('Erreur de chargement du logo:', img.src);
      img.style.display = 'none';
    }
    
    // Essayer le logo suivant
    this.tryNextLogo();
  }

  /** Indique que l’on arrive sur « Commandes en cours » depuis cette page (sections fermées au chargement). */
  setEntryFromForCommandesEnCours(value: string): void {
    try {
      sessionStorage.setItem('commandes-en-cours-entry-from', value);
    } catch {}
  }

  /** Indique que l’on arrive sur « Nouvelle commande » depuis le dashboard (pas de restauration de scroll). */
  clearScrollForNouvelleCommande(): void {
    try {
      sessionStorage.setItem('nouvelle-commande-clear-scroll', '1');
    } catch {}
  }

  tryNextLogo(): void {
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
      this.logoError = false;
      console.log('Essai du logo suivant (sans encodage):', nextLogo);
    } else if (currentIndex === -1 && !currentPath.includes('%20')) {
      // Le logo actuel n'est pas dans la liste, essayer avec encodage
      console.log('Tentative avec encodage des espaces...');
      const encodedLogo = possibleLogos[0].split('/').map(part => encodeURIComponent(part)).join('/');
      this.fallbackLogoPath.set(encodedLogo);
      this.logoError = false;
    } else {
      // Tous les logos ont échoué
      this.logoError = true;
      console.error('Tous les logos ont échoué à charger');
    }
  }
}
