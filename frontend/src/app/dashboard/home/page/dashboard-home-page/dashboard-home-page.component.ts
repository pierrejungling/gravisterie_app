import { Component, OnInit, inject, computed, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '@shared';
import { ApiService, ApiURI, ApiResponse, RealtimeService } from '@api';
import { Commande, StatutCommande, livraisonFaite, isCommandeSiteNonTraitee } from '../../../feature/commande/model/commande.interface';
import { Bon } from '../../../feature/bon/model/bon.interface';
import { BonService } from '../../../feature/bon/service/bon.service';
import { Evenement, aVenir, joursAvant as joursAvantDate, typeEvenement } from '../../../feature/evenement/model/evenement.interface';

/** Jours avant la deadline d'une commande ; null sans deadline ou si elle est déjà livrée. */
const joursDeadline = (c: Commande): number | null => (c.deadline && !livraisonFaite(c) ? joursAvantDate(c.deadline) : null);

/** Étapes de l'atelier, dans l'ordre du Kanban. */
const ETAPES: Array<{ cle: string; label: string; couleur: string; statuts: StatutCommande[] }> = [
  { cle: 'infos', label: 'Infos à recevoir', couleur: 'var(--gv-muted)', statuts: [StatutCommande.EN_ATTENTE_INFORMATION] },
  { cle: 'modele', label: 'À modéliser', couleur: 'var(--gv-warn)', statuts: [StatutCommande.A_MODELLISER_PREPARER] },
  { cle: 'graver', label: 'À graver', couleur: 'var(--gv-accent)', statuts: [StatutCommande.A_GRAVER] },
  { cle: 'finir', label: 'Finition', couleur: '#7a5c99', statuts: [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE] },
  { cle: 'photo', label: 'À prendre en photo', couleur: 'var(--gv-ok)', statuts: [StatutCommande.A_PRENDRE_EN_PHOTO] },
  {
    cle: 'apres',
    label: 'Livrer, facturer, avis',
    couleur: '#3b6e8f',
    statuts: [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS],
  },
];

interface Tache {
  id: string;
  titre: string;
  detail: string;
  tag: string;
  ton: 'danger' | 'warn' | 'accent';
  lien: any[];
  tri: number;
}

@Component({
  selector: 'app-dashboard-home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './dashboard-home-page.component.html',
  styleUrl: './dashboard-home-page.component.scss',
})
export class DashboardHomePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly prenom = signal<string>(localStorage.getItem('currentUser') || '');
  readonly commandes = signal<Commande[]>([]);
  readonly evenements = signal<Evenement[]>([]);
  readonly nbClients = signal<number | null>(null);
  readonly nbBonsActifs = signal<number | null>(null);
  readonly charge = signal(false);

  readonly maintenant = new Date();
  readonly dateLabel = this.maintenant.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly semaine = numeroSemaine(this.maintenant);
  readonly salutation = this.maintenant.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';

  private readonly actives = computed(() => this.commandes().filter((c) => c.statut_commande !== StatutCommande.ANNULEE));
  private readonly enCours = computed(() =>
    this.commandes().filter((c) => c.statut_commande !== StatutCommande.TERMINE && c.statut_commande !== StatutCommande.ANNULEE),
  );

  readonly caAnnee = computed(() =>
    this.actives()
      .filter((c) => c.date_commande && new Date(c.date_commande).getFullYear() === this.maintenant.getFullYear())
      .reduce((s, c) => s + montant(c.prix_final), 0),
  );

  /** Le travail du jour : ce qui est à graver, à finir, et les clients qui attendent une réponse. */
  /** Nouvelles commandes arrivées du site, pas encore traitées (même règle que la pastille du Kanban). */
  readonly nbSiteNew = computed(
    () => this.commandes().filter((c) => c.statut_commande === StatutCommande.EN_ATTENTE_INFORMATION && isCommandeSiteNonTraitee(c)).length,
  );

  readonly aujourdhui = computed(() => {
    const enCours = this.enCours();
    const parDeadline = (a: Commande, b: Commande) => tDeadline(a) - tDeadline(b) || t(a.date_commande) - t(b.date_commande);
    const bloc = (liste: Commande[]) => ({
      nb: liste.length,
      items: [...liste].sort(parDeadline).slice(0, 4).map((c) => ({
        id: c.id_commande,
        titre: c.produit || 'Commande',
        deadline: joursDeadline(c),
      })),
    });
    return {
      graver: bloc(enCours.filter((c) => c.statut_commande === StatutCommande.A_GRAVER || c.statut_commande === StatutCommande.A_MODELLISER_PREPARER)),
      finir: bloc(enCours.filter((c) => c.statut_commande === StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE)),
      attend: bloc(enCours.filter((c) => c.attente_reponse === false)),
    };
  });

  tagDeadline(j: number | null): string {
    if (j === null) return '';
    if (j < 0) return `${j} j`;
    if (j === 0) return "auj.";
    return `J-${j}`;
  }

  readonly kpis = computed(() => {
    const enCours = this.enCours();
    const impayes = this.actives().filter((c) => !c['payé'] && montant(c.prix_final) > 0);
    const retard = enCours.filter((c) => (joursDeadline(c) ?? 0) < 0);
    return {
      enCours: enCours.length,
      clientAttend: enCours.filter((c) => c.attente_reponse === false).length,
      aEncaisser: impayes.reduce((s, c) => s + montant(c.prix_final), 0),
      nbImpayes: impayes.length,
      retard: retard.length,
      terminees: this.commandes().filter((c) => c.statut_commande === StatutCommande.TERMINE).length,
      annulees: this.commandes().filter((c) => c.statut_commande === StatutCommande.ANNULEE).length,
    };
  });

  readonly atelier = computed(() => {
    const enCours = this.enCours();
    const etapes = ETAPES.map((e) => {
      const liste = enCours.filter((c) => e.statuts.includes(c.statut_commande));
      return { ...e, nb: liste.length, retard: liste.filter((c) => (joursDeadline(c) ?? 0) < 0).length };
    }).filter((e) => e.nb > 0);
    const total = etapes.reduce((s, e) => s + e.nb, 0);
    return { etapes, total };
  });

  readonly prochains = computed(() =>
    this.evenements()
      .filter((e) => aVenir(e) && e.statut !== 'prospect')
      .sort((a, b) => t(a.date_debut) - t(b.date_debut))
      .slice(0, 3),
  );

  /** Priorités : deadlines dépassées ou dans les 7 jours, événements de la semaine. */
  readonly taches = computed<Tache[]>(() => {
    const out: Tache[] = [];
    for (const c of this.enCours()) {
      const j = joursDeadline(c);
      if (j === null || j > 7) continue;
      out.push({
        id: c.id_commande,
        titre: c.produit || 'Commande',
        detail: `${libelleEtape(c.statut_commande)} · deadline ${dateCourte(c.deadline)}`,
        tag: j < 0 ? `${j} j` : j === 0 ? "Aujourd'hui" : j === 1 ? 'Demain' : `J-${j}`,
        ton: j < 0 ? 'danger' : j <= 2 ? 'warn' : 'accent',
        lien: ['/dashboard', 'commandes', 'detail', c.id_commande],
        tri: j,
      });
    }
    for (const e of this.prochains()) {
      const j = joursAvantDate(e.date_debut);
      if (j === null || j > 7) continue;
      const fait = (e.materiel ?? []).filter((m) => m.fait).length;
      const total = (e.materiel ?? []).length;
      out.push({
        id: e.id_evenement,
        titre: `Préparer ${e.nom}`,
        detail: total ? `Matériel prêt ${fait} / ${total}` : typeEvenement(e.type).label,
        tag: j <= 0 ? "Aujourd'hui" : j === 1 ? 'Demain' : `J-${j}`,
        ton: 'accent',
        lien: ['/dashboard', 'evenements', e.id_evenement],
        tri: j - 0.5,
      });
    }
    return out.sort((a, b) => a.tri - b.tri).slice(0, 6);
  });

  readonly nbAutresTaches = computed(() => {
    const n = this.enCours().filter((c) => {
      const j = joursDeadline(c);
      return j !== null && j <= 7;
    }).length;
    return Math.max(n - this.taches().filter((x) => x.lien[1] === 'commandes').length, 0);
  });

  ngOnInit(): void {
    this.api.get(ApiURI.ME).subscribe({
      next: (r: ApiResponse) => {
        if (r.result && r.data?.username) {
          this.prenom.set(r.data.username);
          localStorage.setItem('currentUser', r.data.username);
        }
      },
      error: () => undefined,
    });

    this.chargerCommandes();
    this.chargerEvenements();
    this.chargerClients();
    this.chargerBons();

    this.realtime.on('commande').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.chargerCommandes());
    this.realtime.on('evenement').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.chargerEvenements());
    this.realtime.on('client', 'commande').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.chargerClients());
    this.realtime.on('bon').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.chargerBons());
  }

  private chargerCommandes(): void {
    this.api.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (r: ApiResponse) => {
        if (r.result && Array.isArray(r.data)) this.commandes.set(r.data as Commande[]);
        this.charge.set(true);
      },
      error: () => this.charge.set(true),
    });
  }

  private chargerEvenements(): void {
    this.api.get(ApiURI.LISTE_EVENEMENTS).subscribe({
      next: (r: ApiResponse) => {
        if (r.result && Array.isArray(r.data)) this.evenements.set(r.data as Evenement[]);
      },
      error: () => undefined,
    });
  }

  private chargerClients(): void {
    this.api.get(ApiURI.LISTE_CLIENTS).subscribe({
      next: (r: ApiResponse) => {
        if (r.result && Array.isArray(r.data)) this.nbClients.set(r.data.length);
      },
      error: () => undefined,
    });
  }

  private chargerBons(): void {
    this.api.get(ApiURI.LISTE_BONS).subscribe({
      next: (r: ApiResponse) => {
        if (r.result && Array.isArray(r.data)) {
          this.nbBonsActifs.set((r.data as Bon[]).filter((b) => !b.utilise && !BonService.isExpired(b)).length);
        }
      },
      error: () => undefined,
    });
  }

  // ---------- Affichage ----------
  euros(v: number): string {
    return Math.round(v).toLocaleString('fr-BE') + ' €';
  }

  jour(e: Evenement): string {
    return e.date_debut ? String(new Date(e.date_debut).getDate()) : '?';
  }

  moisCourt(e: Evenement): string {
    return e.date_debut ? new Date(e.date_debut).toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '') : '';
  }

  infoEvenement(e: Evenement): string {
    const parts: string[] = [];
    if (e.date_debut) {
      const d = new Date(e.date_debut);
      parts.push(d.toLocaleDateString('fr-BE', { weekday: 'short' }).replace('.', '') + ' ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h '));
    }
    if (e.lieu) parts.push(e.lieu);
    return parts.join(' · ');
  }

  compteurEvenement(e: Evenement): string {
    const j = joursAvantDate(e.date_debut);
    if (j === null) return '';
    if (j <= 0) return "Aujourd'hui";
    if (j === 1) return 'Demain';
    return `Dans ${j} j`;
  }

  materiel(e: Evenement): { fait: number; total: number } {
    const m = e.materiel ?? [];
    return { fait: m.filter((x) => x.fait).length, total: m.length };
  }

  allerEnCours(): void {
    try {
      sessionStorage.setItem('commandes-en-cours-entry-from', 'dashboard');
    } catch {}
    this.router.navigate(['/dashboard', 'commandes', 'en-cours']);
  }

  nouvelleCommande(): void {
    try {
      sessionStorage.setItem('nouvelle-commande-clear-scroll', '1');
    } catch {}
    this.router.navigate(['/dashboard', 'commandes', 'nouvelle']);
  }
}

// ---------- Utilitaires ----------
function montant(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function t(v: string | null | undefined): number {
  return v ? new Date(v).getTime() : Infinity;
}

function tDeadline(c: Commande): number {
  return livraisonFaite(c) ? Infinity : t(c.deadline);
}

function dateCourte(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) : '';
}

function libelleEtape(statut: StatutCommande): string {
  return ETAPES.find((e) => e.statuts.includes(statut))?.label ?? statut;
}

function numeroSemaine(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - debut.getTime()) / 86400000 + 1) / 7);
}
