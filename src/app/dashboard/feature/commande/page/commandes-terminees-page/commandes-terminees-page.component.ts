import { Component, OnInit, inject, signal, WritableSignal, computed } from '@angular/core';
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
export class CommandesTermineesPageComponent implements OnInit {
  commandes: WritableSignal<Commande[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);

  // Commandes terminées et annulées triées par date (plus récentes en premier)
  commandesTermineesTriees = computed(() => {
    const commandesTerminees = this.commandes().filter(cmd => 
      cmd.statut_commande === StatutCommande.TERMINE || cmd.statut_commande === StatutCommande.ANNULEE
    );
    
    // Trier par date de commande (plus récentes en premier)
    // Note: idéalement, il faudrait un champ date_fin dans l'entité Commande
    return [...commandesTerminees].sort((a, b) => {
      const dateA = new Date(a.date_commande).getTime();
      const dateB = new Date(b.date_commande).getTime();
      return dateB - dateA; // Tri décroissant (plus récentes en premier)
    });
  });

  isCommandeAnnulee(commande: Commande): boolean {
    return commande.statut_commande === StatutCommande.ANNULEE;
  }

  ngOnInit(): void {
    this.loadCommandes();
  }

  loadCommandes(): void {
    this.isLoading.set(true);
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.commandes.set(response.data);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des commandes:', error);
        this.isLoading.set(false);
      }
    });
  }

  onCommandeClick(commande: Commande): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande], {
      queryParams: { from: 'terminees' }
    });
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

  trackByCommandeId(index: number, commande: Commande): string {
    return commande.id_commande;
  }
}
