import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EvenementApiService } from '../../service/evenement-api.service';
import { Evenement, ResumeEvenement, aVenir, dateLongue, typeEvenement } from '../../model/evenement.interface';

/**
 * Rattachement d'une commande à un événement.
 * - avec idCommande : le changement est enregistré tout de suite
 * - sans idCommande (nouvelle commande) : le choix est seulement émis (choisi)
 */
@Component({
  selector: 'gv-evenement-lien',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './evenement-lien.component.html',
  styleUrl: './evenement-lien.component.scss',
})
export class EvenementLienComponent implements OnChanges {
  private readonly api = inject(EvenementApiService);

  @Input() idCommande: string | null = null;
  @Input() idEvenement: string | null | undefined = null;
  @Output() choisi = new EventEmitter<string | null>();

  readonly dateLongue = dateLongue;
  readonly typeEvenement = typeEvenement;

  readonly actuel = signal<ResumeEvenement | null>(null);
  readonly ouvert = signal(false);
  readonly liste = signal<Evenement[] | null>(null);
  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);

  /** Événements proposés : à venir d'abord, puis les plus récents. */
  readonly choix = computed(() => {
    const list = this.liste() ?? [];
    const venir = list.filter((e) => aVenir(e)).sort((a, b) => this.t(a.date_debut) - this.t(b.date_debut));
    const passes = list.filter((e) => !aVenir(e) && e.statut !== 'refuse' && e.statut !== 'annule').slice(0, 12);
    return { venir, passes };
  });

  ngOnChanges(): void {
    const id = this.idEvenement || null;
    if (!id) {
      this.actuel.set(null);
      return;
    }
    if (this.actuel()?.id_evenement === id) return;
    this.api.resume(id).subscribe((r) => this.actuel.set(r));
  }

  ouvrir(): void {
    this.erreur.set(null);
    this.ouvert.set(true);
    if (this.liste() === null) this.api.liste().subscribe((l) => this.liste.set(l ?? []));
  }

  fermer(): void {
    this.ouvert.set(false);
  }

  choisir(e: Evenement | null): void {
    const ancien = this.actuel();
    const nouveau: ResumeEvenement | null = e ? { id_evenement: e.id_evenement, nom: e.nom, date_debut: e.date_debut, statut: e.statut } : null;
    if (!this.idCommande) {
      this.actuel.set(nouveau);
      this.ouvert.set(false);
      this.choisi.emit(nouveau?.id_evenement ?? null);
      return;
    }
    this.envoi.set(true);
    const appel = e
      ? this.api.lierCommande(e.id_evenement, this.idCommande)
      : ancien
        ? this.api.delierCommande(ancien.id_evenement, this.idCommande)
        : null;
    if (!appel) {
      this.envoi.set(false);
      this.ouvert.set(false);
      return;
    }
    appel.subscribe((ok) => {
      this.envoi.set(false);
      if (!ok) {
        this.erreur.set("Le rattachement n'a pas pu être enregistré.");
        return;
      }
      this.actuel.set(nouveau);
      this.ouvert.set(false);
      this.choisi.emit(nouveau?.id_evenement ?? null);
    });
  }

  private t(valeur: string | null): number {
    return valeur ? new Date(valeur).getTime() : Infinity;
  }
}
