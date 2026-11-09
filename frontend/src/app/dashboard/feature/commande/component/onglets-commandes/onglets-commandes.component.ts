import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatutCommande } from '../../model/commande.interface';
import { CommandeOngletsService, OngletCommande } from '../../service/commande-onglets.service';

/** Barre d'onglets des commandes ouvertes, sous la barre du haut. */
@Component({
  selector: 'gv-onglets-commandes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onglets-commandes.component.html',
  styleUrl: './onglets-commandes.component.scss',
})
export class OngletsCommandesComponent {
  readonly onglets = inject(CommandeOngletsService);
  @ViewChild('defilement') defilement?: ElementRef<HTMLElement>;

  constructor() {
    this.onglets.demarrer();
    // Garder l'onglet affiché visible quand la barre déborde.
    effect(() => {
      const actif = this.onglets.actif();
      this.onglets.onglets();
      if (!actif) return;
      setTimeout(() => {
        const el = this.defilement?.nativeElement.querySelector<HTMLElement>(`[data-id="${actif}"]`);
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  }

  ton(o: OngletCommande): string {
    if (o.statut === StatutCommande.TERMINE) return 'ok';
    if (o.statut === StatutCommande.ANNULEE) return 'bad';
    if (o.statut === StatutCommande.EN_ATTENTE_INFORMATION) return 'warn';
    return 'accent';
  }

  fermer(event: Event, id: string): void {
    event.stopPropagation();
    this.onglets.fermer(id);
  }

  /** Clic molette : ferme l'onglet, comme dans un navigateur. */
  clicMolette(event: MouseEvent, id: string): void {
    if (event.button === 1) {
      event.preventDefault();
      this.onglets.fermer(id);
    }
  }
}
