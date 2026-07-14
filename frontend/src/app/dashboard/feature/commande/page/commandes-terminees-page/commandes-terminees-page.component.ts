import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande } from '../../model/commande.interface';
import { AppRoutes } from '@shared';

type PeriodSection = 'terminees' | 'annulees';

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
  expandedPeriodKeys: WritableSignal<Set<string>> = signal(new Set<string>());
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly scrollKey = 'commandes-terminees-scroll';
  private readonly ventePrefix = 'Vente | ';

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

  commandesEnCours = computed(() => {
    return this.commandes().filter(cmd =>
      cmd.statut_commande !== StatutCommande.TERMINE &&
      cmd.statut_commande !== StatutCommande.ANNULEE
    );
  });

  totauxEnCoursParPeriode = computed(() => {
    return this.buildTotauxParPeriode(this.commandesEnCours());
  });

  groupedCommandesTerminees = computed(() => {
    const totauxEnCours = this.totauxEnCoursParPeriode();
    return this.groupByPeriod(this.commandesTerminees()).map(group => {
      const totalEnCours = totauxEnCours.get(group.sortKey) ?? 0;
      return {
        ...group,
        totalEnCours,
        totalCombined: group.total + totalEnCours,
      };
    });
  });

  groupedCommandesAnnulees = computed(() => {
    return this.groupByPeriod(this.commandesAnnulees());
  });

  isCommandeAnnulee(commande: Commande): boolean {
    return commande.statut_commande === StatutCommande.ANNULEE;
  }

  isVente(commande: Commande): boolean {
    const produit = commande?.produit || '';
    return produit.trimStart().startsWith(this.ventePrefix);
  }

  isCommandeNonPayee(commande: Commande): boolean {
    const prixFinal = Number(commande.prix_final) || 0;
    return !commande.payé && prixFinal > 0;
  }

  getUnpaidGroupLabel(count: number): string {
    return count === 1 ? 'Non payé' : `${count} non payés`;
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
          this.resetExpandedToCurrentPeriod();
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
    const fullName = `${client.nom || ''} ${client.prénom || ''}`.trim();
    if (fullName) return fullName;
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
    this.resetExpandedToCurrentPeriod();
  }

  isPeriodExpanded(section: PeriodSection, sortKey: string): boolean {
    return this.expandedPeriodKeys().has(this.getPeriodStorageKey(section, sortKey));
  }

  togglePeriod(section: PeriodSection, sortKey: string): void {
    const key = this.getPeriodStorageKey(section, sortKey);
    const next = new Set(this.expandedPeriodKeys());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedPeriodKeys.set(next);
  }

  private getPeriodStorageKey(section: PeriodSection, sortKey: string): string {
    return `${section}:${sortKey}`;
  }

  private getCurrentPeriodSortKey(): string {
    const now = new Date();
    if (this.groupMode() === 'year') {
      return `${now.getFullYear()}`;
    }
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  private resetExpandedToCurrentPeriod(): void {
    const current = this.getCurrentPeriodSortKey();
    const expanded = new Set<string>();

    if (this.groupedCommandesTerminees().some(group => group.sortKey === current)) {
      expanded.add(this.getPeriodStorageKey('terminees', current));
    }
    if (this.groupedCommandesAnnulees().some(group => group.sortKey === current)) {
      expanded.add(this.getPeriodStorageKey('annulees', current));
    }

    this.expandedPeriodKeys.set(expanded);
  }

  private getMontantFraisVente(cmd: Commande): number {
    const prix = Number(cmd.prix_final) || 0;
    const pourcentage = cmd.frais_pourcentage !== undefined && cmd.frais_pourcentage !== null
      ? Number(cmd.frais_pourcentage)
      : 0;
    if (!this.isVente(cmd) || !prix || !pourcentage) return 0;
    return prix * (pourcentage / 100);
  }

  getMontantNetPourTotaux(cmd: Commande): number {
    const prix = Number(cmd.prix_final) || 0;
    if (!this.isVente(cmd)) {
      return prix;
    }
    const frais = this.getMontantFraisVente(cmd);
    return prix - frais;
  }

  getMontantHtvaPourTotaux(cmd: Commande): number {
    if (!this.isVente(cmd)) return 0;
    return this.getMontantNetPourTotaux(cmd) / 1.21;
  }

  getMontantFraisAffiche(cmd: Commande): number {
    return this.getMontantFraisVente(cmd);
  }

  getFraisCommissionLabel(cmd: Commande): string {
    if (cmd.frais_commission_libelle) {
      return cmd.frais_commission_libelle;
    }
    if (cmd.frais_pourcentage !== undefined && cmd.frais_pourcentage !== null) {
      return `${cmd.frais_pourcentage} %`;
    }
    return '';
  }

  private getPeriodKeyAndLabel(date: Date, mode: 'year' | 'month'): { sortKey: string; label: string } {
    const year = date.getFullYear();
    const month = date.getMonth();

    if (mode === 'year') {
      return { sortKey: `${year}`, label: `${year}` };
    }

    const sortKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return { sortKey, label };
  }

  private buildTotauxParPeriode(commandes: Commande[]): Map<string, number> {
    const mode = this.groupMode();
    const totaux = new Map<string, number>();

    for (const cmd of commandes) {
      const date = new Date(cmd.date_commande);
      const sortKey = Number.isNaN(date.getTime())
        ? '0000-00'
        : this.getPeriodKeyAndLabel(date, mode).sortKey;
      totaux.set(sortKey, (totaux.get(sortKey) ?? 0) + this.getMontantNetPourTotaux(cmd));
    }

    return totaux;
  }

  private groupByPeriod(commandes: Commande[]): Array<{ label: string; commandes: Commande[]; sortKey: string; total: number; unpaidCount: number }> {
    const mode = this.groupMode();
    const groups = new Map<string, { label: string; commandes: Commande[]; sortKey: string; total: number; unpaidCount: number }>();

    for (const cmd of commandes) {
      const date = new Date(cmd.date_commande);
      if (Number.isNaN(date.getTime())) {
        const key = 'unknown';
        if (!groups.has(key)) {
          groups.set(key, { label: 'Date inconnue', commandes: [], sortKey: '0000-00', total: 0, unpaidCount: 0 });
        }
        const group = groups.get(key)!;
        group.commandes.push(cmd);
        group.total += this.getMontantNetPourTotaux(cmd);
        if (this.isCommandeNonPayee(cmd)) {
          group.unpaidCount++;
        }
        continue;
      }

      const { sortKey, label } = this.getPeriodKeyAndLabel(date, mode);
      if (!groups.has(sortKey)) {
        groups.set(sortKey, { label, commandes: [], sortKey, total: 0, unpaidCount: 0 });
      }
      const group = groups.get(sortKey)!;
      group.commandes.push(cmd);
      group.total += this.getMontantNetPourTotaux(cmd);
      if (this.isCommandeNonPayee(cmd)) {
        group.unpaidCount++;
      }
    }

    return Array.from(groups.values()).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }

  trackByCommandeId(index: number, commande: Commande): string {
    return commande.id_commande;
  }
}
