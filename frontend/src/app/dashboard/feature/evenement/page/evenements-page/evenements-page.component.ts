import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '@shared';
import { RealtimeService } from '@api';
import { EvenementApiService } from '../../service/evenement-api.service';
import {
  Evenement,
  TYPES_EVENEMENT,
  TypeEvenement,
  aVenir,
  dateLongue,
  depuisChampDate,
  euros,
  horaire,
  joursAvant,
  nomClientEvenement,
  statutEvenement,
  typeEvenement,
} from '../../model/evenement.interface';

type Vue = 'a_venir' | 'passes' | 'tous';

@Component({
  selector: 'app-evenements-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './evenements-page.component.html',
  styleUrl: './evenements-page.component.scss',
})
export class EvenementsPageComponent implements OnInit {
  private readonly api = inject(EvenementApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = TYPES_EVENEMENT;
  readonly euros = euros;
  readonly dateLongue = dateLongue;
  readonly horaire = horaire;
  readonly typeEvenement = typeEvenement;
  readonly statutEvenement = statutEvenement;
  readonly nomClientEvenement = nomClientEvenement;

  readonly evenements = signal<Evenement[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly vue = signal<Vue>('a_venir');

  // Création
  readonly creationOuverte = signal(false);
  readonly creationEnCours = signal(false);
  readonly creationErreur = signal<string | null>(null);
  nouveau: { nom: string; type: TypeEvenement; date: string; lieu: string } = { nom: '', type: 'gravure_direct', date: '', lieu: '' };

  readonly aVenirList = computed(() =>
    this.evenements()
      .filter((e) => aVenir(e))
      .sort((a, b) => this.t(a.date_debut, Infinity) - this.t(b.date_debut, Infinity)),
  );
  readonly passesList = computed(() => this.evenements().filter((e) => !aVenir(e)));

  readonly visibles = computed(() => {
    const v = this.vue();
    if (v === 'a_venir') return this.aVenirList();
    if (v === 'passes') return this.passesList();
    return this.evenements();
  });

  readonly kpis = computed(() => {
    const annee = new Date().getFullYear();
    const list = this.evenements();
    const ceteAnnee = list.filter((e) => e.date_debut && new Date(e.date_debut).getFullYear() === annee && e.statut !== 'refuse' && e.statut !== 'annule');
    const aEncaisser = list.filter((e) => (e.statut === 'confirme' || e.statut === 'termine') && !e.paye && e.stats.prestation > 0);
    return {
      aVenir: this.aVenirList().length,
      prochain: this.aVenirList().find((e) => e.statut === 'confirme') ?? this.aVenirList()[0] ?? null,
      nbAnnee: ceteAnnee.length,
      caAnnee: ceteAnnee.reduce((s, e) => s + e.stats.total, 0),
      aEncaisser: aEncaisser.reduce((s, e) => s + e.stats.prestation, 0),
      nbAEncaisser: aEncaisser.length,
    };
  });

  readonly annee = new Date().getFullYear();

  ngOnInit(): void {
    this.charger();
    this.realtime
      .on('evenement', 'commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.charger(false));
  }

  charger(afficher = true): void {
    if (afficher) this.loading.set(true);
    this.api.liste().subscribe((list) => {
      this.loading.set(false);
      if (!list) {
        this.erreur.set('Impossible de charger les événements.');
        return;
      }
      this.erreur.set(null);
      this.evenements.set(list);
    });
  }

  ouvrir(e: Evenement): void {
    this.router.navigate(['/dashboard', 'evenements', e.id_evenement]);
  }

  jour(e: Evenement): string {
    return e.date_debut ? String(new Date(e.date_debut).getDate()) : '?';
  }

  mois(e: Evenement): string {
    return e.date_debut ? new Date(e.date_debut).toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '') : '';
  }

  /** « Aujourd'hui », « Demain », « Dans 3 j » pour les événements à venir. */
  compteur(e: Evenement): string | null {
    if (!aVenir(e)) return null;
    const j = joursAvant(e.date_debut);
    if (j === null) return null;
    if (j < 0) return 'En cours';
    if (j === 0) return "Aujourd'hui";
    if (j === 1) return 'Demain';
    return `Dans ${j} j`;
  }

  // ---------- Création ----------
  ouvrirCreation(): void {
    this.nouveau = { nom: '', type: 'gravure_direct', date: '', lieu: '' };
    this.creationErreur.set(null);
    this.creationOuverte.set(true);
  }

  fermerCreation(): void {
    if (!this.creationEnCours()) this.creationOuverte.set(false);
  }

  creer(): void {
    if (!this.nouveau.nom.trim()) {
      this.creationErreur.set("Donne un nom à l'événement.");
      return;
    }
    this.creationEnCours.set(true);
    this.creationErreur.set(null);
    this.api
      .creer({
        nom: this.nouveau.nom.trim(),
        type: this.nouveau.type,
        date_debut: depuisChampDate(this.nouveau.date),
        lieu: this.nouveau.lieu.trim() || null,
        statut: 'propose',
      })
      .subscribe((e) => {
        this.creationEnCours.set(false);
        if (!e) {
          this.creationErreur.set("L'événement n'a pas pu être créé.");
          return;
        }
        this.creationOuverte.set(false);
        this.router.navigate(['/dashboard', 'evenements', e.id_evenement]);
      });
  }

  private t(valeur: string | null, defaut: number): number {
    return valeur ? new Date(valeur).getTime() : defaut;
  }
}
