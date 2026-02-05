import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande } from '../../model/commande.interface';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-commandes-terminees-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './commandes-terminees-page.component.html',
  styleUrl: './commandes-terminees-page.component.scss'
})
export class CommandesTermineesPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  commandes: WritableSignal<Commande[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  private scrollRestored: boolean = false;
  groupMode: WritableSignal<'year' | 'month'> = signal('month');
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly scrollKey = 'commandes-terminees-scroll';

  // Commandes terminées triées par date (plus récentes en premier)
  commandesTerminees = computed(() => {
    const commandesTerminees = this.commandes().filter(cmd => 
      cmd.statut_commande === StatutCommande.TERMINE
    );
    
    // Trier par date de commande (plus récentes en premier)
    return [...commandesTerminees].sort((a, b) => {
      const dateA = new Date(a.date_commande).getTime();
      const dateB = new Date(b.date_commande).getTime();
      return dateB - dateA; // Tri décroissant (plus récentes en premier)
    });
  });

  // Commandes annulées triées par date (plus récentes en premier)
  commandesAnnulees = computed(() => {
    const commandesAnnulees = this.commandes().filter(cmd => 
      cmd.statut_commande === StatutCommande.ANNULEE
    );
    
    // Trier par date de commande (plus récentes en premier)
    return [...commandesAnnulees].sort((a, b) => {
      const dateA = new Date(a.date_commande).getTime();
      const dateB = new Date(b.date_commande).getTime();
      return dateB - dateA; // Tri décroissant (plus récentes en premier)
    });
  });

  groupedCommandesTerminees = computed(() => {
    return this.groupByPeriod(this.commandesTerminees());
  });

  groupedCommandesAnnulees = computed(() => {
    return this.groupByPeriod(this.commandesAnnulees());
  });

  isCommandeAnnulee(commande: Commande): boolean {
    return commande.statut_commande === StatutCommande.ANNULEE;
  }

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

  private readonly entryFromKey = 'commandes-en-cours-entry-from';
  private readonly detailReturnPageKey = 'detail-return-page';

  onCommandeClick(commande: Commande): void {
    try {
      sessionStorage.setItem(this.detailReturnPageKey, 'terminees');
    } catch {}
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande]);
  }

  navigateToEnCours(): void {
    try {
      sessionStorage.setItem(this.entryFromKey, 'terminees');
    } catch {}
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'en-cours']);
  }

  getClientName(client: Commande['client']): string {
    if (!client) return 'Client inconnu';
    if (client.nom && client.prénom) {
      return `${client.nom} ${client.prénom}`;
    }
    if (client.nom) return client.nom;
    if (client.prénom) return client.prénom;
    return 'Client inconnu';
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  }

  setGroupMode(mode: 'year' | 'month'): void {
    this.groupMode.set(mode);
  }

  private groupByPeriod(commandes: Commande[]): Array<{ label: string; commandes: Commande[]; total: number }> {
    const mode = this.groupMode();
    const groups = new Map<string, { label: string; commandes: Commande[]; sortKey: string; total: number }>();

    for (const cmd of commandes) {
      const date = new Date(cmd.date_commande);
      if (Number.isNaN(date.getTime())) {
        const key = 'unknown';
        if (!groups.has(key)) {
          groups.set(key, { label: 'Date inconnue', commandes: [], sortKey: '0000-00', total: 0 });
        }
        const group = groups.get(key)!;
        group.commandes.push(cmd);
        group.total += Number(cmd.prix_final) || 0;
        continue;
      }

      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      if (mode === 'year') {
        const key = `${year}`;
        if (!groups.has(key)) {
          groups.set(key, { label: `${year}`, commandes: [], sortKey: `${year}`, total: 0 });
        }
        const group = groups.get(key)!;
        group.commandes.push(cmd);
        group.total += Number(cmd.prix_final) || 0;
      } else {
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        if (!groups.has(key)) {
          groups.set(key, { label, commandes: [], sortKey: key, total: 0 });
        }
        const group = groups.get(key)!;
        group.commandes.push(cmd);
        group.total += Number(cmd.prix_final) || 0;
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }

  trackByCommandeId(index: number, commande: Commande): string {
    return commande.id_commande;
  }
}
