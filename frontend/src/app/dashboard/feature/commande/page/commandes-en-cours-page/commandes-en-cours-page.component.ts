import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande, ModeContact } from '../../model/commande.interface';
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
  /** Ne décider (fermer tout / restaurer) qu'au premier chargement ; après, garder l'état des sections. */
  private initialExpandedStateApplied: boolean = false;
  
  @ViewChild('tableScroll', { static: false }) tableScrollElement?: ElementRef<HTMLDivElement>;
  @ViewChild('mobileContainer', { static: false }) mobileContainerElement?: ElementRef<HTMLDivElement>;
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly scrollKey = 'commandes-en-cours-scroll';
  private readonly expandedSectionsKey = 'commandes-en-cours-expanded-sections';
  private readonly restoreExpandedKey = 'commandes-en-cours-restore-expanded';
  private readonly entryFromKey = 'commandes-en-cours-entry-from';
  private readonly detailReturnPageKey = 'detail-return-page';

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

  // Labels pour chaque statut (version courte pour l'affichage dans la liste)
  readonly statutLabels: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: 'Attente',
    [StatutCommande.A_MODELLISER_PREPARER]: 'Modélisation',
    [StatutCommande.A_GRAVER]: 'Gravure',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'Finition',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: 'Photo',
    [StatutCommande.A_LIVRER]: 'Livraison',
    [StatutCommande.A_METTRE_EN_LIGNE]: 'WEB',
    [StatutCommande.A_FACTURER]: 'Facturation',
    [StatutCommande.DEMANDE_AVIS]: 'Avis',
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

  /** Sections repliables (vue mobile) : ensemble des statuts dont la section est ouverte */
  expandedSections: WritableSignal<Set<StatutCommande>> = signal(new Set<StatutCommande>([]));

  isSectionExpanded(statut: StatutCommande): boolean {
    return this.expandedSections().has(statut);
  }

  toggleSection(statut: StatutCommande): void {
    const next = new Set(this.expandedSections());
    if (next.has(statut)) {
      next.delete(statut);
    } else {
      next.add(statut);
    }
    this.expandedSections.set(next);
    this.saveExpandedSections(next);
  }

  private saveExpandedSections(sections: Set<StatutCommande>): void {
    try {
      sessionStorage.setItem(this.expandedSectionsKey, JSON.stringify([...sections]));
    } catch {
      // ignorer si sessionStorage indisponible
    }
  }

  /** Au chargement : fermer tout si on vient du dashboard/terminées/nouvelle (sessionStorage) ; sinon restaurer les sections. */
  private setInitialExpandedSections(): void {
    try {
      const entryFrom = sessionStorage.getItem(this.entryFromKey);
      if (entryFrom === 'dashboard' || entryFrom === 'terminees' || entryFrom === 'nouvelle') {
        sessionStorage.removeItem(this.entryFromKey);
        this.expandedSections.set(new Set<StatutCommande>());
        this.saveExpandedSections(new Set<StatutCommande>());
        return;
      }
    } catch {
      // ignorer
    }

    try {
      if (sessionStorage.getItem(this.restoreExpandedKey) === '1') {
        sessionStorage.removeItem(this.restoreExpandedKey);
      }
    } catch {
      // ignorer
    }

    this.restoreExpandedSections();
  }

  private restoreExpandedSections(): void {
    try {
      const raw = sessionStorage.getItem(this.expandedSectionsKey);
      if (!raw) {
        this.expandedSections.set(new Set<StatutCommande>());
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.expandedSections.set(new Set<StatutCommande>());
        return;
      }
      // Whitelist : seules les valeurs de statuts (strings) sont acceptées (fiable en prod)
      const allowed = new Set<string>(this.statuts as unknown as string[]);
      const valid = new Set<StatutCommande>();
      for (const s of parsed) {
        if (typeof s === 'string' && allowed.has(s)) {
          valid.add(s as StatutCommande);
        }
      }
      this.expandedSections.set(valid);
    } catch {
      this.expandedSections.set(new Set<StatutCommande>());
    }
  }

  hasAnyCommandeEnCours(): boolean {
    return this.statuts.some(statut => this.getCommandesByStatut(statut).length > 0);
  }

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.loadCommandes();
  }

  ngAfterViewChecked(): void {
    // Restaurer la position de scroll après le chargement initial des données
    if (!this.isLoading() && !this.scrollRestored) {
      const savedScroll = sessionStorage.getItem(this.scrollKey);
      if (savedScroll) {
        // Attendre un peu pour que les ViewChild soient initialisés
        setTimeout(() => {
          // Vérifier à nouveau que scrollRestored n'a pas été modifié entre-temps
          if (!this.scrollRestored) {
            this.restoreScrollPosition(parseInt(savedScroll, 10));
          }
        }, 200);
      }
    }
  }

  private restoreScrollPosition(scrollPosition: number): void {
    // Méthode robuste compatible Safari avec plusieurs tentatives
    const attemptScroll = (attempts: number = 0) => {
      if (attempts > 30) {
        // Arrêter après 30 tentatives (augmenté pour Safari)
        this.scrollRestored = true;
        return;
      }

      requestAnimationFrame(() => {
        const container = this.getScrollContainer();
        
        if (container) {
          // Restaurer le scroll du conteneur interne
          // Safari nécessite plusieurs méthodes pour fonctionner correctement
          
          // Méthode 1 : scrollTop direct
          container.scrollTop = scrollPosition;
          
          // Méthode 2 : scrollTo si disponible
          if (typeof container.scrollTo === 'function') {
            try {
              container.scrollTo({
                top: scrollPosition,
                left: 0,
                behavior: 'auto'
              });
            } catch (e) {
              // Ignorer les erreurs
            }
          }

          // Vérifier si le scroll a fonctionné (avec une marge d'erreur de 5px)
          // Utiliser setTimeout pour laisser Safari appliquer le scroll
          setTimeout(() => {
            const currentScroll = container.scrollTop;
            
            if (Math.abs(currentScroll - scrollPosition) <= 5) {
              // Scroll réussi, marquer comme restauré
              this.scrollRestored = true;
            } else {
              // Réessayer après un court délai (délai augmenté pour Safari)
              setTimeout(() => attemptScroll(attempts + 1), 200);
            }
          }, 150);
        } else if (document.readyState === 'complete' || document.readyState === 'interactive') {
          // Fallback sur window scroll si le conteneur n'est pas encore disponible
          // Mais on attend un peu plus pour que les ViewChild soient initialisés
          if (attempts < 10) {
            setTimeout(() => attemptScroll(attempts + 1), 100);
          } else {
            // Si après 10 tentatives le conteneur n'est toujours pas disponible, utiliser window
            window.scrollTo({
              top: scrollPosition,
              left: 0,
              behavior: 'auto'
            });
            document.documentElement.scrollTop = scrollPosition;
            document.body.scrollTop = scrollPosition;
            
            setTimeout(() => {
              const currentScroll = this.getCurrentScrollPosition();
              if (Math.abs(currentScroll - scrollPosition) <= 5) {
                this.scrollRestored = true;
              } else {
                setTimeout(() => attemptScroll(attempts + 1), 150);
              }
            }, 100);
          }
        } else {
          // Attendre que le document soit prêt
          setTimeout(() => attemptScroll(attempts + 1), 100);
        }
      });
    };

    // Commencer la restauration après un délai initial (augmenté pour Safari)
    // Safari a besoin de plus de temps pour initialiser les ViewChild
    setTimeout(() => attemptScroll(), 250);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  private onBeforeUnload = (): void => {
    // Sauvegarder le scroll du conteneur approprié
    const scrollPos = this.getCurrentScrollPosition();
    sessionStorage.setItem(this.scrollKey, scrollPos.toString());
  };

  private getScrollContainer(): HTMLElement | null {
    // Détecter quelle vue est active en vérifiant la visibilité des éléments
    // Sur mobile, .desktop-view est caché, sur desktop .mobile-view est caché
    const isMobile = window.innerWidth <= 768;
    
    // Essayer d'abord avec les ViewChild
    if (isMobile) {
      // Vue mobile : utiliser le conteneur mobile
      if (this.mobileContainerElement?.nativeElement) {
        return this.mobileContainerElement.nativeElement;
      }
    } else {
      // Vue desktop : utiliser le conteneur du tableau
      if (this.tableScrollElement?.nativeElement) {
        return this.tableScrollElement.nativeElement;
      }
    }
    
    // Fallback : essayer les deux ViewChild si la détection échoue
    if (this.tableScrollElement?.nativeElement) {
      return this.tableScrollElement.nativeElement;
    }
    if (this.mobileContainerElement?.nativeElement) {
      return this.mobileContainerElement.nativeElement;
    }
    
    // Fallback final : utiliser querySelector pour trouver les éléments directement
    // Cela fonctionne même si les ViewChild ne sont pas encore initialisés
    if (isMobile) {
      const mobileContainer = document.querySelector('.commandes-en-cours-container') as HTMLElement;
      if (mobileContainer && mobileContainer.scrollHeight > mobileContainer.clientHeight) {
        return mobileContainer;
      }
    } else {
      const tableScroll = document.querySelector('.table-scroll') as HTMLElement;
      if (tableScroll && tableScroll.scrollHeight > tableScroll.clientHeight) {
        return tableScroll;
      }
    }
    
    // Dernier fallback : essayer les deux conteneurs
    const tableScroll = document.querySelector('.table-scroll') as HTMLElement;
    if (tableScroll) return tableScroll;
    
    const mobileContainer = document.querySelector('.commandes-en-cours-container') as HTMLElement;
    if (mobileContainer) return mobileContainer;
    
    return null;
  }

  private getCurrentScrollPosition(): number {
    const container = this.getScrollContainer();
    if (container) {
      // Scroll interne du conteneur
      return container.scrollTop;
    }
    // Fallback sur window scroll (pour le chargement initial)
    return window.pageYOffset || 
           document.documentElement.scrollTop || 
           document.body.scrollTop || 
           (window.scrollY !== undefined ? window.scrollY : 0);
  }

  loadCommandes(): void {
    this.isLoading.set(true);
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.commandes.set(response.data);
          // Ne réappliquer la logique (fermer tout / restaurer) qu'au premier chargement
          if (!this.initialExpandedStateApplied) {
            this.setInitialExpandedSections();
            this.initialExpandedStateApplied = true;
          }
        }
        this.isLoading.set(false);
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
    
    let commandesFiltrees: Commande[] = [];
    
    if (statutsFinaux.includes(statut)) {
      // Afficher les commandes qui ont ce statut dans statuts_actifs
      commandesFiltrees = commandesNonTerminees.filter(c => 
        c.statuts_actifs && c.statuts_actifs.includes(statut)
      );
    } else if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
      // Pour "À Prendre en photo", exclure les commandes qui ont déjà des statuts_actifs
      // (car elles sont passées aux 4 dernières colonnes)
      commandesFiltrees = commandesNonTerminees.filter(c => 
        c.statut_commande === statut && (!c.statuts_actifs || c.statuts_actifs.length === 0)
      );
    } else {
      // Pour les autres colonnes, utiliser le statut principal
      commandesFiltrees = commandesNonTerminees.filter(c => c.statut_commande === statut);
    }
    
    // Trier les commandes selon le type de deadline
    return this.sortCommandesByDeadline(commandesFiltrees);
  }

  /**
   * Trie les commandes selon le type de deadline :
   * 1. Deadlines passées (danger) -> en haut
   * 2. Deadlines dans moins de 7 jours (warning) -> juste après
   * 3. Le reste -> trié par date d'ajout (date_commande) - plus récentes en premier
   */
  private sortCommandesByDeadline(commandes: Commande[]): Commande[] {
    return [...commandes].sort((a, b) => {
      const statusA = this.getDeadlineStatus(a);
      const statusB = this.getDeadlineStatus(b);
      
      // Priorité 1 : Deadlines passées (danger) en premier
      if (statusA === 'danger' && statusB !== 'danger') {
        return -1;
      }
      if (statusA !== 'danger' && statusB === 'danger') {
        return 1;
      }
      
      // Priorité 2 : Deadlines dans moins de 7 jours (warning) après les passées
      if (statusA === 'warning' && statusB !== 'warning' && statusB !== 'danger') {
        return -1;
      }
      if (statusA !== 'warning' && statusA !== 'danger' && statusB === 'warning') {
        return 1;
      }
      
      // Priorité 3 : Pour les commandes avec le même statut de deadline, trier par date d'ajout
      // Plus anciennes en premier (date_commande croissante)
      const dateA = a.date_commande ? new Date(a.date_commande).getTime() : 0;
      const dateB = b.date_commande ? new Date(b.date_commande).getTime() : 0;
      
      return dateA - dateB; // Croissant : plus anciennes en premier
    });
  }

  onCheckboxChange(commande: Commande, statut: StatutCommande): void {
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Mettre à jour localement immédiatement pour un feedback instantané
    const commandes = [...this.commandes()];
    const index = commandes.findIndex(c => c.id_commande === commande.id_commande);
    
    if (index !== -1) {
      const updatedCommande = { ...commandes[index] };
      
      if (statutsFinaux.includes(statut)) {
        // Pour les statuts finaux : retirer de statuts_actifs (marquer comme terminé)
        if (updatedCommande.statuts_actifs) {
          updatedCommande.statuts_actifs = updatedCommande.statuts_actifs.filter(s => s !== statut);
          if (updatedCommande.statuts_actifs.length === 0) {
            updatedCommande.statuts_actifs = undefined;
          }
          
          // Si tous les 4 statuts finaux sont complétés, passer à TERMINE
          const tousCompletes = statutsFinaux.every(s => 
            !updatedCommande.statuts_actifs || !updatedCommande.statuts_actifs.includes(s)
          );
          
          if (tousCompletes) {
            updatedCommande.statut_commande = StatutCommande.TERMINE;
            updatedCommande.statuts_actifs = undefined;
          }
        }
      } else {
        // Pour les autres statuts : passer au statut suivant dans l'ordre
        const ordreEtapes: StatutCommande[] = [
          StatutCommande.EN_ATTENTE_INFORMATION,
          StatutCommande.A_MODELLISER_PREPARER,
          StatutCommande.A_GRAVER,
          StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
          StatutCommande.A_PRENDRE_EN_PHOTO,
        ];
        const currentIndex = ordreEtapes.indexOf(statut);
        if (currentIndex !== -1 && currentIndex < ordreEtapes.length - 1) {
          updatedCommande.statut_commande = ordreEtapes[currentIndex + 1];
        } else if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
          // Si on termine "À Prendre en photo", créer statuts_actifs avec les 4 statuts finaux
          updatedCommande.statuts_actifs = [...statutsFinaux];
        }
      }
      
      commandes[index] = updatedCommande;
      this.commandes.set(commandes);
    }
    
    // Appeler l'API pour mettre à jour en base de données
    this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
      id_commande: commande.id_commande,
      statut: statut
    }).subscribe({
      next: (response) => {
        // Utiliser la réponse de l'API pour synchroniser l'état (le backend peut avoir fait des changements supplémentaires)
        if (response.result && response.data) {
          const commandes = [...this.commandes()];
          const index = commandes.findIndex(c => c.id_commande === commande.id_commande);
          if (index !== -1) {
            commandes[index] = { ...commandes[index], ...response.data };
            this.commandes.set(commandes);
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        // En cas d'erreur, recharger pour restaurer l'état correct
        this.loadCommandes();
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
    // Mettre à jour localement immédiatement pour un feedback instantané
    const commandes = [...this.commandes()];
    const index = commandes.findIndex(c => c.id_commande === commande.id_commande);
    
    if (index !== -1) {
      const updatedCommande = { ...commandes[index] };
      
      // Si on décoche "À Prendre en photo", retirer statuts_actifs
      if (etapePrecedente === StatutCommande.A_PRENDRE_EN_PHOTO) {
        updatedCommande.statuts_actifs = undefined;
        updatedCommande.statut_commande = StatutCommande.A_PRENDRE_EN_PHOTO;
      } else {
        // Sinon, revenir au statut précédent
        updatedCommande.statut_commande = etapePrecedente;
        // Si on revient en arrière depuis les statuts finaux, retirer statuts_actifs
        const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
        if (updatedCommande.statuts_actifs && updatedCommande.statuts_actifs.length > 0) {
          updatedCommande.statuts_actifs = undefined;
        }
      }
      
      commandes[index] = updatedCommande;
      this.commandes.set(commandes);
    }
    
    // Appeler l'API pour mettre à jour en base de données
    this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
      id_commande: commande.id_commande,
      statut: etapePrecedente
    }).subscribe({
      next: () => {
        // Mise à jour réussie, les données locales sont déjà à jour
      },
      error: (error) => {
        console.error('Erreur lors du retour en arrière:', error);
        // En cas d'erreur, recharger pour restaurer l'état correct
        this.loadCommandes();
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

  getStatutEmoji(statut: StatutCommande): string {
    return this.statutEmojis[statut] ?? '';
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
    const fullName = `${nom} ${prenom}`.trim();
    return fullName || 'Non renseigné';
  }

  getModeContactEmoji(modeContact?: string): string {
    if (!modeContact) return '';
    switch (modeContact) {
      case ModeContact.MAIL:
        return '📧';
      case ModeContact.TEL:
        return '📞';
      case ModeContact.META:
        return '💬';
      default:
        return '';
    }
  }

  trackByCommandeId(index: number, commande: Commande): string {
    return commande.id_commande;
  }

  private isLivraisonTerminee(commande: Commande): boolean {
    if (!commande) return false;
    if (commande.statut_commande === StatutCommande.TERMINE) return true;
    if (commande.statut_commande === StatutCommande.ANNULEE) return true;

    // Dans le workflow, à partir du moment où on passe aux "statuts finaux",
    // `statuts_actifs` contient les étapes restantes (non terminées).
    // Donc si `A_LIVRER` n'est plus dedans, la livraison est faite.
    if (Array.isArray(commande.statuts_actifs)) {
      return !commande.statuts_actifs.includes(StatutCommande.A_LIVRER);
    }

    // Fallback: si pour une raison quelconque `statuts_actifs` est absent mais que le statut
    // principal est déjà après "Livraison", on considère la livraison terminée.
    return [
      StatutCommande.A_METTRE_EN_LIGNE,
      StatutCommande.A_FACTURER,
      StatutCommande.DEMANDE_AVIS,
    ].includes(commande.statut_commande);
  }

  // Calculer le statut de la deadline pour la coloration
  getDeadlineStatus(commande: Commande): 'warning' | 'danger' | null {
    if (!commande || !commande.deadline) {
      return null;
    }

    // Si la livraison est déjà terminée, ne plus mettre en évidence la deadline.
    if (this.isLivraisonTerminee(commande)) {
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
    try {
      sessionStorage.setItem(this.restoreExpandedKey, '1');
      sessionStorage.setItem(this.detailReturnPageKey, 'en-cours');
    } catch {
      // ignorer
    }
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande]);
  }

  navigateToTerminees(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'terminees']);
  }

  navigateToNouvelleCommande(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'nouvelle']);
  }

  onAttenteReponseChange(commande: Commande, event: Event): void {
    const target = event.target as HTMLInputElement;
    const attenteReponseValue = target.checked;

    // Envoyer la mise à jour à la base de données
    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${commande.id_commande}`, {
      attente_reponse: attenteReponseValue
    }).subscribe({
      next: () => {
        // Mettre à jour localement pour un feedback immédiat
        commande.attente_reponse = attenteReponseValue;
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour de l\'attente réponse:', error);
        // Revert la valeur en cas d'erreur
        target.checked = !attenteReponseValue;
      }
    });
  }
}
