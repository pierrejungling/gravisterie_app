import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande } from '../../model/commande.interface';
import { Payload } from '@shared';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-commandes-en-cours-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './commandes-en-cours-page.component.html',
  styleUrl: './commandes-en-cours-page.component.scss'
})
export class CommandesEnCoursPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  commandes: WritableSignal<Commande[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  private scrollRestored: boolean = false;
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly scrollKey = 'commandes-en-cours-scroll';

  // Ordre des colonnes de statut
  readonly statuts: StatutCommande[] = [
    StatutCommande.EN_ATTENTE_INFORMATION,
    StatutCommande.A_MODELLISER_PREPARER,
    StatutCommande.A_GRAVER,
    StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
    StatutCommande.A_PRENDRE_EN_PHOTO,
    StatutCommande.A_LIVRER,
    StatutCommande.A_METTRE_EN_LIGNE,
    StatutCommande.A_FACTURER,
    StatutCommande.DEMANDE_AVIS,
  ];

  // Labels pour chaque statut
  readonly statutLabels: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: 'En Attente de + d\'infos',
    [StatutCommande.A_MODELLISER_PREPARER]: 'À Modéliser / Préparer',
    [StatutCommande.A_GRAVER]: 'À Graver',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'À Finir / Laver / Assembler / Peindre',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: 'À Prendre en photo',
    [StatutCommande.A_LIVRER]: 'À Livrer',
    [StatutCommande.A_METTRE_EN_LIGNE]: 'À Mettre en ligne',
    [StatutCommande.A_FACTURER]: 'À Facturer',
    [StatutCommande.DEMANDE_AVIS]: 'Demande d\'avis',
    [StatutCommande.TERMINE]: 'Terminé',
    [StatutCommande.ANNULEE]: 'Annulée',
  };

  // Emojis pour chaque statut
  readonly statutEmojis: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: '⏳',
    [StatutCommande.A_MODELLISER_PREPARER]: '💻',
    [StatutCommande.A_GRAVER]: '⚒️',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: '🎨',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: '📸',
    [StatutCommande.A_LIVRER]: '🚚',
    [StatutCommande.A_METTRE_EN_LIGNE]: '🌐',
    [StatutCommande.A_FACTURER]: '💰',
    [StatutCommande.DEMANDE_AVIS]: '💬',
    [StatutCommande.TERMINE]: '✅',
    [StatutCommande.ANNULEE]: '❌',
  };

  ngOnInit(): void {
    // Sauvegarder la position de scroll avant le rechargement
    window.addEventListener('beforeunload', this.saveScrollPosition);
    this.loadCommandes();
  }

  ngAfterViewChecked(): void {
    // Restaurer la position de scroll après le chargement des données
    if (!this.isLoading() && !this.scrollRestored) {
      const savedScroll = sessionStorage.getItem(this.scrollKey);
      if (savedScroll) {
        this.restoreScrollPosition(parseInt(savedScroll, 10));
      }
    }
  }

  private restoreScrollPosition(scrollPosition: number): void {
    // Méthode robuste compatible Safari avec plusieurs tentatives
    const attemptScroll = (attempts: number = 0) => {
      if (attempts > 10) {
        // Arrêter après 10 tentatives
        this.scrollRestored = true;
        return;
      }

      requestAnimationFrame(() => {
        // Vérifier que le document est prêt
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          // Essayer différentes méthodes de scroll pour compatibilité Safari
          window.scrollTo(0, scrollPosition);
          document.documentElement.scrollTop = scrollPosition;
          document.body.scrollTop = scrollPosition;

          // Vérifier si le scroll a fonctionné (avec une marge d'erreur de 5px)
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          if (Math.abs(currentScroll - scrollPosition) <= 5) {
            this.scrollRestored = true;
          } else {
            // Réessayer après un court délai
            setTimeout(() => attemptScroll(attempts + 1), 50);
          }
        } else {
          // Attendre que le document soit prêt
          setTimeout(() => attemptScroll(attempts + 1), 50);
        }
      });
    };

    // Commencer la restauration après un court délai initial
    setTimeout(() => attemptScroll(), 100);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.saveScrollPosition);
  }

  private saveScrollPosition = (): void => {
    sessionStorage.setItem(this.scrollKey, window.scrollY.toString());
  }

  loadCommandes(): void {
    this.isLoading.set(true);
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.commandes.set(response.data);
        }
        this.isLoading.set(false);
        // Réinitialiser le flag pour permettre la restauration après le chargement
        this.scrollRestored = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des commandes:', error);
        this.isLoading.set(false);
        this.scrollRestored = false;
      }
    });
  }

  getCommandesByStatut(statut: StatutCommande): Commande[] {
    // Ne pas afficher les commandes terminées ni annulées
    const commandesNonTerminees = this.commandes().filter(c => 
      c.statut_commande !== StatutCommande.TERMINE && c.statut_commande !== StatutCommande.ANNULEE
    );
    
    // Pour les 4 dernières colonnes, vérifier aussi statuts_actifs
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    if (statutsFinaux.includes(statut)) {
      // Afficher les commandes qui ont ce statut dans statuts_actifs
      return commandesNonTerminees.filter(c => 
        c.statuts_actifs && c.statuts_actifs.includes(statut)
      );
    }
    
    // Pour "À Prendre en photo", exclure les commandes qui ont déjà des statuts_actifs
    // (car elles sont passées aux 4 dernières colonnes)
    if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
      return commandesNonTerminees.filter(c => 
        c.statut_commande === statut && (!c.statuts_actifs || c.statuts_actifs.length === 0)
      );
    }
    
    // Pour les autres colonnes, utiliser le statut principal
    return commandesNonTerminees.filter(c => c.statut_commande === statut);
  }

  onCheckboxChange(commande: Commande, statut: StatutCommande): void {
    // Appeler l'API pour mettre à jour le statut
    this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
      id_commande: commande.id_commande,
      statut: statut
    }).subscribe({
      next: () => {
        // Recharger les commandes après la mise à jour
        this.loadCommandes();
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
      }
    });
  }

  onEtapePrecedenteChange(event: Event, commande: Commande, etapePrecedente: StatutCommande): void {
    const target = event.target as HTMLInputElement;
    // Si la checkbox est décochée, faire revenir la commande à cette étape
    if (!target.checked) {
      this.onEtapePrecedenteUncheck(commande, etapePrecedente);
    }
  }

  onEtapePrecedenteUncheck(commande: Commande, etapePrecedente: StatutCommande): void {
    // Quand on décoche une étape précédente, faire revenir la commande à cette étape
    this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
      id_commande: commande.id_commande,
      statut: etapePrecedente
    }).subscribe({
      next: () => {
        // Recharger les commandes après la mise à jour
        this.loadCommandes();
      },
      error: (error) => {
        console.error('Erreur lors du retour en arrière:', error);
      }
    });
  }

  isCommandeInStatut(commande: Commande, statut: StatutCommande): boolean {
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    if (statutsFinaux.includes(statut)) {
      // Pour les 3 dernières colonnes, vérifier si le statut est dans statuts_actifs
      return commande.statuts_actifs?.includes(statut) || false;
    }
    
    // Pour les autres colonnes, vérifier le statut principal
    return commande.statut_commande === statut;
  }

  isCheckboxChecked(commande: Commande, statut: StatutCommande): boolean {
    // Les checkboxes ne sont jamais cochées par défaut
    // Elles sont cochées uniquement après avoir été cliquées (ce qui déclenche la transition)
    // Pour les 3 dernières colonnes, une commande apparaît dans la colonne mais n'est pas encore complétée
    return false;
  }

  getEtapesPrecedentes(commande: Commande, statutActuel: StatutCommande): StatutCommande[] {
    // Ordre des étapes dans le workflow
    const ordreEtapes: StatutCommande[] = [
      StatutCommande.EN_ATTENTE_INFORMATION,
      StatutCommande.A_MODELLISER_PREPARER,
      StatutCommande.A_GRAVER,
      StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
      StatutCommande.A_PRENDRE_EN_PHOTO,
    ];

    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Pour les 4 dernières colonnes, toutes les étapes précédentes sont complétées
    if (statutsFinaux.includes(statutActuel)) {
      return ordreEtapes; // Toutes les étapes sont complétées, incluant "À Prendre en photo"
    }

    // Trouver l'index de l'étape actuelle
    const indexActuel = ordreEtapes.indexOf(statutActuel);
    
    // Si l'étape actuelle n'est pas dans l'ordre, retourner toutes les étapes
    if (indexActuel === -1) {
      return ordreEtapes;
    }

    // Retourner toutes les étapes précédentes (non incluses)
    return ordreEtapes.slice(0, indexActuel);
  }

  isEtapePrecedente(commande: Commande, etapePrecedente: StatutCommande, statutActuel: StatutCommande): boolean {
    // Vérifier si cette étape précédente peut être décochée pour revenir en arrière
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Si on est dans les colonnes finales et qu'on décoche "À Prendre en photo", c'est spécial
    if (statutsFinaux.includes(statutActuel) && etapePrecedente === StatutCommande.A_PRENDRE_EN_PHOTO) {
      return true; // On peut décocher "À Prendre en photo" pour revenir en arrière
    }
    return true; // Par défaut, toutes les étapes précédentes peuvent être décochées
  }

  getStatutLabel(statut: StatutCommande): string {
    return this.statutLabels[statut];
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  getClientName(client: Commande['client']): string {
    const nom = client.nom || '';
    const prenom = client.prénom || '';
    return `${nom} ${prenom}`.trim() || 'Non renseigné';
  }

  trackByCommandeId(index: number, commande: Commande): string {
    return commande.id_commande;
  }

  // Calculer le statut de la deadline pour la coloration
  getDeadlineStatus(commande: Commande): 'warning' | 'danger' | null {
    if (!commande || !commande.deadline) {
      return null;
    }

    const deadlineDate = new Date(commande.deadline);
    const today = new Date();
    // Réinitialiser les heures pour comparer uniquement les dates
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Rouge si deadline aujourd'hui ou dépassée
    if (diffDays <= 0) {
      return 'danger';
    }
    // Orange si J-7 (7 jours ou moins avant la deadline)
    if (diffDays <= 7) {
      return 'warning';
    }

    return null;
  }

  onCommandeClick(commande: Commande): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande], {
      queryParams: { from: 'en-cours' }
    });
  }

  navigateToTerminees(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'terminees']);
  }

  navigateToNouvelleCommande(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'nouvelle']);
  }
}
