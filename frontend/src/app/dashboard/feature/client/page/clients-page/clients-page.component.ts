import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '@shared';
import { ClientPickerComponent } from '../../component/client-picker/client-picker.component';
import { RealtimeService } from '@api';
import { ClientApiService } from '../../service/client-api.service';
import { ClientPayload, FicheClient, adresseUtile, dateCourte, euros, initialesClient, nomClient } from '../../model/client.interface';

type Tri = 'recent' | 'ca' | 'commandes' | 'nom';
type Filtre = 'tous' | 'en_cours' | 'a_payer';

/** Un groupe de doublons, avec la fiche cible et les fiches cochées pour la fusion. */
interface GroupeDoublons {
  fiches: FicheClient[];
  cible: string;
  inclus: Set<string>;
  /** Fiche cible choisie hors du groupe : toutes les fiches cochées y sont rattachées. */
  externe: FicheClient | null;
  choixExterne: boolean;
}

const PAGE = 60;

function normaliser(valeur: string | null | undefined): string {
  return (valeur || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

import { CodeDecoComponent, EasterComponent } from '../../../../../shared/ui/deco';

@Component({
  selector: 'app-clients-page',
  standalone: true,
  imports: [CodeDecoComponent, EasterComponent, CommonModule, FormsModule, HeaderComponent, ClientPickerComponent],
  templateUrl: './clients-page.component.html',
  styleUrl: './clients-page.component.scss',
})
export class ClientsPageComponent implements OnInit {
  private readonly clientApi = inject(ClientApiService);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly nomClient = nomClient;
  readonly initialesClient = initialesClient;
  readonly euros = euros;
  readonly dateCourte = dateCourte;
  readonly adresseUtile = adresseUtile;

  readonly onglet = signal<'liste' | 'doublons'>('liste');
  readonly clients = signal<FicheClient[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);

  readonly recherche = signal('');
  readonly tri = signal<Tri>('recent');
  readonly filtre = signal<Filtre>('tous');
  readonly limite = signal(PAGE);

  // Création
  readonly creationOuverte = signal(false);
  readonly creationEnCours = signal(false);
  readonly creationErreur = signal<string | null>(null);
  nouveau: ClientPayload = {};

  // Doublons
  readonly doublons = signal<GroupeDoublons[]>([]);
  readonly doublonsLoading = signal(false);
  readonly doublonsCharges = signal(false);
  readonly fusionEnCours = signal<number | null>(null);
  readonly fusionConfirm = signal<number | null>(null);
  readonly fusionErreur = signal<string | null>(null);

  readonly totaux = computed(() => {
    const list = this.clients();
    return {
      fiches: list.length,
      actifs: list.filter((c) => c.stats.nb_en_cours > 0).length,
      ca: list.reduce((s, c) => s + (c.stats.ca_total || 0), 0),
      aPayer: list.reduce((s, c) => s + (c.stats.reste_a_payer || 0), 0),
      nbAPayer: list.filter((c) => c.stats.reste_a_payer > 0).length,
    };
  });

  readonly filtres = computed<FicheClient[]>(() => {
    const termes = normaliser(this.recherche()).split(/\s+/).filter(Boolean);
    const telRecherche = this.recherche().replace(/\D/g, '');
    let list = this.clients().filter((c) => {
      if (this.filtre() === 'en_cours' && c.stats.nb_en_cours === 0) return false;
      if (this.filtre() === 'a_payer' && c.stats.reste_a_payer <= 0) return false;
      if (termes.length === 0) return true;
      const texte = normaliser([c.prénom, c.nom, c.société, c.mail, c.adresse, c.tva].join(' '));
      const tel = (c.téléphone || '').replace(/\D/g, '');
      if (telRecherche.length >= 4 && tel.includes(telRecherche)) return true;
      return termes.every((t) => texte.includes(t));
    });
    const tri = this.tri();
    list = [...list].sort((a, b) => {
      if (tri === 'ca') return b.stats.ca_total - a.stats.ca_total;
      if (tri === 'commandes') return b.stats.nb_commandes - a.stats.nb_commandes;
      if (tri === 'nom') return normaliser(nomClient(a)).localeCompare(normaliser(nomClient(b)));
      return (b.stats.derniere_commande || '').localeCompare(a.stats.derniere_commande || '');
    });
    return list;
  });

  readonly visibles = computed(() => this.filtres().slice(0, this.limite()));
  readonly nbFichesDoublons = computed(() => this.doublons().reduce((s, g) => s + g.fiches.length, 0));

  ngOnInit(): void {
    this.charger();
    this.chargerDoublons();
    this.realtime
      .on('client', 'commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.charger(false);
        if (this.onglet() === 'doublons' && this.fusionEnCours() === null) this.chargerDoublons();
      });
  }

  charger(afficherChargement = true): void {
    if (afficherChargement) this.loading.set(true);
    this.clientApi.liste().subscribe({
      next: (list) => {
        this.clients.set(list);
        this.loading.set(false);
        this.erreur.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set('Impossible de charger les clients.');
      },
    });
  }

  chargerDoublons(): void {
    this.doublonsLoading.set(true);
    this.clientApi.doublons().subscribe({
      next: (groupes) => {
        this.doublons.set(
          groupes.map((fiches) => {
            // Cible par défaut : la fiche avec le plus de commandes, puis la plus complète.
            const cible = [...fiches].sort(
              (a, b) => b.stats.nb_commandes - a.stats.nb_commandes || this.completude(b) - this.completude(a),
            )[0];
            return { fiches, cible: cible.id_client, inclus: new Set(fiches.map((f) => f.id_client)), externe: null, choixExterne: false };
          }),
        );
        this.doublonsLoading.set(false);
        this.doublonsCharges.set(true);
      },
      error: () => {
        this.doublonsLoading.set(false);
        this.doublonsCharges.set(true);
      },
    });
  }

  private completude(c: FicheClient): number {
    return [c.nom, c.prénom, c.société, c.mail, c.téléphone, adresseUtile(c.adresse), c.tva].filter((v) => !!v && String(v).trim()).length;
  }

  setRecherche(event: Event): void {
    this.recherche.set((event.target as HTMLInputElement).value);
    this.limite.set(PAGE);
  }

  setFiltre(filtre: Filtre): void {
    this.filtre.set(this.filtre() === filtre ? 'tous' : filtre);
    this.limite.set(PAGE);
  }

  afficherPlus(): void {
    this.limite.update((l) => l + PAGE);
  }

  ouvrir(client: FicheClient): void {
    this.router.navigate(['/dashboard', 'clients', client.id_client]);
  }

  contact(c: FicheClient): string {
    const societe = c.société && nomClient(c) !== c.société ? c.société : null;
    return [societe, c.mail, c.téléphone].filter(Boolean).join(' · ');
  }

  // ---------- Création ----------
  ouvrirCreation(): void {
    this.nouveau = {};
    this.creationErreur.set(null);
    this.creationOuverte.set(true);
  }

  fermerCreation(): void {
    if (!this.creationEnCours()) this.creationOuverte.set(false);
  }

  creer(): void {
    const p = this.nouveau;
    if (![p.nom, p.prenom, p.societe].some((v) => v && v.trim())) {
      this.creationErreur.set('Indique au moins un nom, un prénom ou une société.');
      return;
    }
    this.creationEnCours.set(true);
    this.creationErreur.set(null);
    this.clientApi.ajouter(p).subscribe({
      next: (client) => {
        this.creationEnCours.set(false);
        if (!client) {
          this.creationErreur.set('La fiche n’a pas pu être créée.');
          return;
        }
        this.creationOuverte.set(false);
        this.router.navigate(['/dashboard', 'clients', client.id_client]);
      },
      error: (err) => {
        this.creationEnCours.set(false);
        this.creationErreur.set(err?.error?.message || 'La fiche n’a pas pu être créée.');
      },
    });
  }

  // ---------- Doublons ----------
  choisirCible(index: number, id: string): void {
    this.doublons.update((groupes) =>
      groupes.map((g, i) => {
        if (i !== index) return g;
        const inclus = new Set(g.inclus);
        inclus.add(id);
        return { ...g, cible: id, inclus, externe: null, choixExterne: false };
      }),
    );
    this.fusionConfirm.set(null);
  }

  basculerInclus(index: number, id: string): void {
    this.doublons.update((groupes) =>
      groupes.map((g, i) => {
        if (i !== index || (id === g.cible && !g.externe)) return g;
        const inclus = new Set(g.inclus);
        if (inclus.has(id)) inclus.delete(id);
        else inclus.add(id);
        return { ...g, inclus };
      }),
    );
    this.fusionConfirm.set(null);
  }

  sources(groupe: GroupeDoublons): FicheClient[] {
    if (groupe.externe) return groupe.fiches.filter((f) => groupe.inclus.has(f.id_client));
    return groupe.fiches.filter((f) => f.id_client !== groupe.cible && groupe.inclus.has(f.id_client));
  }

  cibleDe(groupe: GroupeDoublons): FicheClient | undefined {
    return groupe.externe ?? groupe.fiches.find((f) => f.id_client === groupe.cible);
  }

  idsGroupe(groupe: GroupeDoublons): string[] {
    return groupe.fiches.map((f) => f.id_client);
  }

  ouvrirChoixExterne(index: number, ouvert: boolean): void {
    this.doublons.update((groupes) => groupes.map((g, i) => (i === index ? { ...g, choixExterne: ouvert } : g)));
    this.fusionConfirm.set(null);
  }

  choisirCibleExterne(index: number, client: FicheClient): void {
    this.doublons.update((groupes) =>
      groupes.map((g, i) => (i === index ? { ...g, externe: client, choixExterne: false } : g)),
    );
    this.fusionConfirm.set(null);
  }

  retirerCibleExterne(index: number): void {
    this.doublons.update((groupes) =>
      groupes.map((g, i) => {
        if (i !== index) return g;
        const inclus = new Set(g.inclus);
        inclus.add(g.cible);
        return { ...g, externe: null, inclus };
      }),
    );
    this.fusionConfirm.set(null);
  }

  ignorerGroupe(index: number): void {
    this.doublons.update((groupes) => groupes.filter((_, i) => i !== index));
    this.fusionConfirm.set(null);
  }

  fusionner(index: number): void {
    const groupe = this.doublons()[index];
    if (!groupe) return;
    const sources = this.sources(groupe).map((f) => f.id_client);
    if (sources.length === 0) return;
    if (this.fusionConfirm() !== index) {
      this.fusionConfirm.set(index);
      return;
    }
    this.fusionEnCours.set(index);
    this.fusionErreur.set(null);
    this.clientApi.fusionner(groupe.externe?.id_client ?? groupe.cible, sources).subscribe({
      next: (res) => {
        this.fusionEnCours.set(null);
        this.fusionConfirm.set(null);
        if (!res) {
          this.fusionErreur.set('La fusion a échoué.');
          return;
        }
        this.charger(false);
        this.chargerDoublons();
      },
      error: (err) => {
        this.fusionEnCours.set(null);
        this.fusionErreur.set(err?.error?.message || 'La fusion a échoué.');
      },
    });
  }
}
