import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed, WritableSignal, ViewChild, ElementRef, ChangeDetectorRef, NgZone, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { concatMap, from, last } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '@shared';
import { ApiService, RealtimeService } from '@api';
import { ApiURI } from '@api';
import {
  Commande,
  StatutCommande,
  ModeContact,
  isCommandeSite,
  isCommandeSiteNonTraitee,
  formatProduitCommandeSite,
} from '../../model/commande.interface';
import { AppRoutes } from '@shared';

type Ton = 'warn' | 'danger' | null;

/** Une des quatre actions de clôture d'une carte (livraison, web, facture, avis). */
interface FinalVue {
  statut: StatutCommande;
  label: string;
  fait: boolean;
}

/** Carte du Kanban, prête à afficher. */
interface CarteVue {
  c: Commande;
  id: string;
  titre: string;
  client: string;
  societe: string;
  contact: string;
  echeance: string;
  ton: Ton;
  prix: number | null;
  paye: boolean;
  siteNew: boolean;
  attend: boolean;
  /** Statut d'où part la carte lors d'un glisser-déposer. */
  source: StatutCommande;
  finaux: FinalVue[];
}

interface ColonneVue {
  cle: string;
  statut: StatutCommande;
  label: string;
  couleur: string;
  final: boolean;
  total: number;
  cartes: CarteVue[];
}

@Component({
  selector: 'app-commandes-en-cours-page',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './commandes-en-cours-page.component.html',
  styleUrl: './commandes-en-cours-page.component.scss'
})
export class CommandesEnCoursPageComponent implements OnInit, OnDestroy {
  commandes: WritableSignal<Commande[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  loadError: WritableSignal<string | null> = signal(null);

  /** Filtres de la barre du haut. */
  filtre: WritableSignal<string> = signal('');
  filtreAttend: WritableSignal<boolean> = signal(false);
  filtreUrgent: WritableSignal<boolean> = signal(false);
  /** Sous-filtre de la colonne Clôture (une des quatre actions restantes). */
  filtreFinal: WritableSignal<StatutCommande | null> = signal(null);
  /** Colonne affichée sur écran étroit (une colonne à la fois). */
  onglet: WritableSignal<string> = signal('attente');

  private premierChargementFait = false;
  private draggedRecently: boolean = false;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private static readonly POINTER_DRAG_THRESHOLD_PX = 6;
  private static readonly COLUMN_SWITCH_HYSTERESIS_PX = 10;
  /** En dessous de cette largeur : une colonne à la fois, pas de glisser-déposer. */
  private static readonly LARGEUR_COLONNES_PX = 1100;

  private columnDropRects: Array<{ statut: StatutCommande; left: number; right: number }> = [];
  private dragMoveRaf: number | null = null;
  private pendingPointerX = 0;
  private pendingPointerY = 0;
  private lastResolvedDropStatut: StatutCommande | null = null;

  private pointerDrag: {
    commande: Commande;
    sourceStatut: StatutCommande;
    startX: number;
    startY: number;
    active: boolean;
    pointerId: number;
    captureElement: HTMLElement;
    cardElement: HTMLElement;
    offsetX: number;
    offsetY: number;
  } | null = null;

  private dragGhost: HTMLElement | null = null;

  private readonly onDocumentPointerMove = (event: PointerEvent): void => {
    this.handleDocumentPointerMove(event);
  };

  private readonly onDocumentPointerUp = (event: PointerEvent): void => {
    this.handleDocumentPointerUp(event);
  };

  /** Glisser-déposer (écran large) */
  dragCommandeId: string | null = null;
  dragSourceStatut: StatutCommande | null = null;
  dragOverStatut: WritableSignal<StatutCommande | null> = signal(null);
  dragOverFinalsGroup: WritableSignal<boolean> = signal(false);
  isStatutMoveInProgress: boolean = false;

  @ViewChild('board', { static: false }) boardElement?: ElementRef<HTMLDivElement>;

  private readonly apiService: ApiService = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private refreshEnAttente = false;
  private readonly router: Router = inject(Router);
  private readonly scrollKey = 'commandes-en-cours-scroll';
  private readonly ongletKey = 'kanban-onglet';
  private readonly entryFromKey = 'commandes-en-cours-entry-from';
  private readonly detailReturnPageKey = 'detail-return-page';

  // Ordre des statuts (les quatre derniers se font en parallèle, dans la colonne Clôture)
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

  readonly statutsFinaux: StatutCommande[] = [
    StatutCommande.A_LIVRER,
    StatutCommande.A_METTRE_EN_LIGNE,
    StatutCommande.A_FACTURER,
    StatutCommande.DEMANDE_AVIS,
  ];

  /** Statut qui représente la colonne Clôture (cible du glisser-déposer). */
  readonly firstFinalStatut: StatutCommande = StatutCommande.A_LIVRER;

  private readonly ordreEtapes: StatutCommande[] = [
    StatutCommande.EN_ATTENTE_INFORMATION,
    StatutCommande.A_MODELLISER_PREPARER,
    StatutCommande.A_GRAVER,
    StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
    StatutCommande.A_PRENDRE_EN_PHOTO,
  ];

  readonly statutLabels: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: 'Attente',
    [StatutCommande.A_MODELLISER_PREPARER]: 'Modélisation',
    [StatutCommande.A_GRAVER]: 'Gravure',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'Finition',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: 'Photo',
    [StatutCommande.A_LIVRER]: 'Livraison',
    [StatutCommande.A_METTRE_EN_LIGNE]: 'Web',
    [StatutCommande.A_FACTURER]: 'Facture',
    [StatutCommande.DEMANDE_AVIS]: 'Avis',
    [StatutCommande.TERMINE]: 'Terminé',
    [StatutCommande.ANNULEE]: 'Annulée',
  };

  /** Les six colonnes du tableau : cinq étapes, puis la clôture qui regroupe les quatre actions finales. */
  private readonly colonnesDef: Array<{ cle: string; statut: StatutCommande; label: string; couleur: string; final: boolean }> = [
    { cle: 'attente', statut: StatutCommande.EN_ATTENTE_INFORMATION, label: 'Attente', couleur: 'var(--gv-muted)', final: false },
    { cle: 'modele', statut: StatutCommande.A_MODELLISER_PREPARER, label: 'Modélisation', couleur: 'var(--gv-warn)', final: false },
    { cle: 'graver', statut: StatutCommande.A_GRAVER, label: 'Gravure', couleur: 'var(--gv-accent)', final: false },
    { cle: 'finition', statut: StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE, label: 'Finition', couleur: '#7a5c99', final: false },
    { cle: 'photo', statut: StatutCommande.A_PRENDRE_EN_PHOTO, label: 'Photo', couleur: 'var(--gv-ok)', final: false },
    { cle: 'cloture', statut: StatutCommande.A_LIVRER, label: 'Clôture', couleur: '#3b6e8f', final: true },
  ];

  /** Commandes encore ouvertes (ni terminées ni annulées). */
  readonly enCours = computed(() =>
    this.commandes().filter(
      (c) => c.statut_commande !== StatutCommande.TERMINE && c.statut_commande !== StatutCommande.ANNULEE,
    ),
  );

  readonly nbAttend = computed(() => this.enCours().filter((c) => c.attente_reponse === false).length);
  readonly nbUrgent = computed(() => this.enCours().filter((c) => this.getDeadlineStatus(c) !== null).length);
  readonly nbSiteNew = computed(() => this.enCours().filter((c) => this.estSiteNew(c)).length);
  readonly filtreActif = computed(() => !!this.filtre().trim() || this.filtreAttend() || this.filtreUrgent());

  /** Nombre de commandes par action de clôture restante. */
  readonly compteFinaux = computed(() => {
    const ouvertes = this.enCours();
    return this.statutsFinaux.map((statut) => ({
      statut,
      label: this.statutLabels[statut],
      nb: ouvertes.filter((c) => c.statuts_actifs?.includes(statut)).length,
    }));
  });

  /** Colonnes et cartes prêtes à afficher, filtres appliqués. */
  readonly colonnesVue = computed<ColonneVue[]>(() => {
    const ouvertes = this.enCours();
    const texte = this.normaliser(this.filtre().trim());
    const attend = this.filtreAttend();
    const urgent = this.filtreUrgent();
    const final = this.filtreFinal();

    return this.colonnesDef.map((def) => {
      const brutes = def.final
        ? ouvertes.filter((c) => (c.statuts_actifs?.length ?? 0) > 0)
        : ouvertes.filter(
            (c) => c.statut_commande === def.statut && (c.statuts_actifs?.length ?? 0) === 0,
          );
      const triees = this.sortCommandesByDeadline(brutes, def.statut);
      const cartes = triees
        .filter((c) => !attend || c.attente_reponse === false)
        .filter((c) => !urgent || this.getDeadlineStatus(c) !== null)
        .filter((c) => !def.final || !final || !!c.statuts_actifs?.includes(final))
        .filter((c) => !texte || this.texteRecherche(c).includes(texte))
        .map((c) => this.versCarte(c, def.statut, def.final));
      return { ...def, total: brutes.length, cartes };
    });
  });

  readonly nbAffichees = computed(() => this.colonnesVue().reduce((n, col) => n + col.cartes.length, 0));

  private normaliser(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  private texteRecherche(c: Commande): string {
    return this.normaliser(
      [this.getProduitAffiche(c), c.client?.nom, c.client?.prénom, c.client?.['société']].filter(Boolean).join(' '),
    );
  }

  private estSiteNew(c: Commande): boolean {
    return c.statut_commande === this.statutCommandesSite && isCommandeSiteNonTraitee(c);
  }

  private versCarte(c: Commande, statut: StatutCommande, final: boolean): CarteVue {
    const ech = this.echeance(c);
    const actifs = c.statuts_actifs ?? [];
    return {
      c,
      id: c.id_commande,
      titre: this.getProduitAffiche(c),
      client: this.getClientName(c.client),
      societe: c.client?.['société'] ?? '',
      contact: this.getModeContactEmoji(c.mode_contact),
      echeance: ech.txt,
      ton: ech.ton,
      prix: c.prix_final != null && Number(c.prix_final) > 0 ? Number(c.prix_final) : null,
      paye: !!c['payé'],
      siteNew: !final && this.estSiteNew(c),
      attend: c.attente_reponse === false,
      source: final ? (actifs[0] ?? statut) : statut,
      finaux: final
        ? this.statutsFinaux.map((s) => ({ statut: s, label: this.statutLabels[s], fait: !actifs.includes(s) }))
        : [],
    };
  }

  /** Texte court de l'échéance : « Retard 2 j », « Auj. », « J-3 · 12/11 », sinon la date de réception. */
  private echeance(c: Commande): { txt: string; ton: Ton } {
    const jm = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    if (!c.deadline) {
      return { txt: c.date_commande ? `reçu ${jm(new Date(c.date_commande))}` : '', ton: null };
    }
    const dl = new Date(c.deadline);
    const jour = new Date(dl);
    jour.setHours(0, 0, 0, 0);
    const auj = new Date();
    auj.setHours(0, 0, 0, 0);
    const j = Math.ceil((jour.getTime() - auj.getTime()) / 86400000);
    const statut = this.getDeadlineStatus(c);
    const ton: Ton = statut === 'danger' ? 'danger' : statut === 'warning' ? 'warn' : null;
    if (statut === null) {
      return { txt: jm(dl), ton };
    }
    if (j < 0) {
      return { txt: `Retard ${-j} j`, ton };
    }
    if (j === 0) {
      return { txt: 'Auj.', ton };
    }
    return { txt: `J-${j} · ${jm(dl)}`, ton };
  }

  hasAnyCommandeEnCours(): boolean {
    return this.enCours().length > 0;
  }

  ngOnInit(): void {
    try {
      const o = sessionStorage.getItem(this.ongletKey);
      if (o && this.colonnesDef.some((d) => d.cle === o)) {
        this.onglet.set(o);
      }
    } catch {
      // ignorer
    }
    this.loadCommandes();
    this.realtime.on('commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCommandes(true));
  }

  ngOnDestroy(): void {
    this.cancelDragMoveRaf();
    this.cleanupPointerDragListeners();
    this.removeDragGhost();
    this.resetDragState(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    this.mesurerHaut();
  }

  /** Hauteur disponible pour les colonnes : on mesure où commence le tableau dans la page. */
  private mesurerHaut(): void {
    const board = this.boardElement?.nativeElement;
    if (!board) {
      return;
    }
    const haut = Math.round(board.getBoundingClientRect().top + window.scrollY);
    this.host.nativeElement.style.setProperty('--kb-top', `${haut}px`);
  }

  choisirOnglet(cle: string): void {
    this.onglet.set(cle);
    try {
      sessionStorage.setItem(this.ongletKey, cle);
    } catch {
      // ignorer
    }
    window.scrollTo({ top: 0 });
  }

  basculerFiltreFinal(statut: StatutCommande): void {
    this.filtreFinal.set(this.filtreFinal() === statut ? null : statut);
  }

  effacerFiltres(): void {
    this.filtre.set('');
    this.filtreAttend.set(false);
    this.filtreUrgent.set(false);
    this.filtreFinal.set(null);
  }

  /** Après le premier chargement : onglet par défaut, hauteur des colonnes, retour à la position précédente. */
  private apresPremierChargement(): void {
    let depuisAilleurs = false;
    try {
      const entryFrom = sessionStorage.getItem(this.entryFromKey);
      if (entryFrom === 'dashboard' || entryFrom === 'terminees' || entryFrom === 'nouvelle') {
        sessionStorage.removeItem(this.entryFromKey);
        sessionStorage.removeItem(this.scrollKey);
        depuisAilleurs = true;
      }
    } catch {
      // ignorer
    }

    const colonnes = this.colonnesVue();
    const courante = colonnes.find((col) => col.cle === this.onglet());
    if (depuisAilleurs || !courante || courante.total === 0) {
      const premiere = colonnes.find((col) => col.total > 0);
      if (premiere && (depuisAilleurs || !courante || courante.total === 0)) {
        this.onglet.set(premiere.cle);
      }
    }

    setTimeout(() => {
      this.mesurerHaut();
      if (!depuisAilleurs) {
        // Deux passes : les cartes peuvent ne pas être encore dessinées à la première
        requestAnimationFrame(() => this.restaurerScroll(false));
        setTimeout(() => this.restaurerScroll(true), 350);
      }
    });
  }

  private sauverScroll(): void {
    const board = this.boardElement?.nativeElement;
    if (!board) {
      return;
    }
    const cols: Record<string, number> = {};
    board.querySelectorAll<HTMLElement>('.kb-col').forEach((col) => {
      const liste = col.querySelector<HTMLElement>('.kb-col__liste');
      if (liste && col.dataset['cle']) {
        cols[col.dataset['cle']] = liste.scrollTop;
      }
    });
    try {
      sessionStorage.setItem(this.scrollKey, JSON.stringify({ cols, win: window.scrollY }));
    } catch {
      // ignorer
    }
  }

  private restaurerScroll(derniere: boolean): void {
    const board = this.boardElement?.nativeElement;
    if (!board) {
      return;
    }
    try {
      const brut = sessionStorage.getItem(this.scrollKey);
      if (!brut) {
        return;
      }
      // Position valable une seule fois : au retour de la fiche d'une commande
      if (derniere) {
        sessionStorage.removeItem(this.scrollKey);
      }
      const etat = JSON.parse(brut) as { cols?: Record<string, number>; win?: number };
      board.querySelectorAll<HTMLElement>('.kb-col').forEach((col) => {
        const liste = col.querySelector<HTMLElement>('.kb-col__liste');
        const y = etat.cols?.[col.dataset['cle'] ?? ''];
        if (liste && typeof y === 'number') {
          liste.scrollTop = y;
        }
      });
      if (typeof etat.win === 'number' && etat.win > 0) {
        window.scrollTo({ top: etat.win });
      }
    } catch {
      // ignorer
    }
  }

  /** Bascule « Client attend » / « Rien à faire » sans quitter le tableau. */
  basculerAttente(commande: Commande): void {
    const avant = commande.attente_reponse;
    const apres = avant === false;
    this.remplacer(commande.id_commande, { attente_reponse: apres });
    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${commande.id_commande}`, { attente_reponse: apres }).subscribe({
      error: (error) => {
        console.error('Erreur lors de la mise à jour de l\'attente réponse:', error);
        this.remplacer(commande.id_commande, { attente_reponse: avant });
      },
    });
  }

  /** Coche ou décoche une des quatre actions de clôture. */
  basculerFinal(commande: Commande, statut: StatutCommande): void {
    if (this.isStatutMoveInProgress) {
      return;
    }
    const actifs = commande.statuts_actifs ?? [];
    if (actifs.includes(statut)) {
      this.onCheckboxChange(commande, statut);
      return;
    }
    // Déjà fait : on la remet à faire (le backend bascule sur le même appel)
    this.remplacer(commande.id_commande, {
      statuts_actifs: this.statutsFinaux.filter((s) => s === statut || actifs.includes(s)),
    });
    this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, { id_commande: commande.id_commande, statut }).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.remplacer(commande.id_commande, response.data);
        }
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        this.loadCommandes();
      },
    });
  }

  /** Étape suivante (bouton ✓ de la carte). */
  avancer(carte: CarteVue): void {
    if (this.isStatutMoveInProgress) {
      return;
    }
    this.onCheckboxChange(carte.c, carte.source);
  }

  /** Étape précédente (bouton ← de la carte). */
  reculer(carte: CarteVue, colonne: ColonneVue): void {
    if (this.isStatutMoveInProgress) {
      return;
    }
    if (colonne.final) {
      this.onEtapePrecedenteUncheck(carte.c, StatutCommande.A_PRENDRE_EN_PHOTO);
      return;
    }
    const i = this.ordreEtapes.indexOf(colonne.statut);
    if (i > 0) {
      this.onEtapePrecedenteUncheck(carte.c, this.ordreEtapes[i - 1]);
    }
  }

  private remplacer(id: string, patch: Partial<Commande>): void {
    this.commandes.set(this.commandes().map((c) => (c.id_commande === id ? { ...c, ...patch } : c)));
  }

  loadCommandes(silent = false): void {
    if (silent && (this.pointerDrag || this.dragCommandeId)) {
      this.refreshEnAttente = true;
      return;
    }
    if (!silent) {
      this.isLoading.set(true);
    }
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe({
      next: (response) => {
        if (response.result && Array.isArray(response.data)) {
          this.commandes.set(response.data);
          this.loadError.set(null);
          if (!this.premierChargementFait) {
            this.premierChargementFait = true;
            this.apresPremierChargement();
          }
        } else if (!silent || this.commandes().length === 0) {
          this.loadError.set('Impossible de charger les commandes.');
        }
        if (!silent) {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des commandes:', error);
        if (!silent || this.commandes().length === 0) {
          this.loadError.set('Impossible de charger les commandes.');
        }
        if (!silent) {
          this.isLoading.set(false);
        }
      }
    });
  }


  /** Colonne où arrivent les commandes du site vitrine (webhook). */
  readonly statutCommandesSite = StatutCommande.EN_ATTENTE_INFORMATION;

  isColonneCommandesSite(statut: StatutCommande): boolean {
    return statut === this.statutCommandesSite;
  }

  afficherNotifCommandeSite(commande: Commande, statut: StatutCommande): boolean {
    return this.isColonneCommandesSite(statut) && isCommandeSiteNonTraitee(commande);
  }

  getProduitAffiche(commande: Commande): string {
    const raw = commande.produit || `Commande #${commande.id_commande.substring(0, 8)}`;
    return isCommandeSite(commande) ? formatProduitCommandeSite(raw) || raw : raw;
  }

  /**
   * Trie les commandes selon le type de deadline :
   * 1. Deadlines passées (danger) -> en haut
   * 2. Deadlines dans moins de 7 jours (warning) -> juste après
   * 3. Le reste -> trié par date d'ajout (date_commande) - plus récentes en premier
   */
  countCommandesSiteNonTraitees(): number {
    return this.nbSiteNew();
  }

  private sortCommandesByDeadline(commandes: Commande[], statut: StatutCommande): Commande[] {
    return [...commandes].sort((a, b) => {
      if (this.isColonneCommandesSite(statut)) {
        const siteA = isCommandeSiteNonTraitee(a);
        const siteB = isCommandeSiteNonTraitee(b);

        // Priorité 0 (colonne Attente) : nouvelles commandes site en haut, plus récentes d'abord
        if (siteA && !siteB) {
          return -1;
        }
        if (!siteA && siteB) {
          return 1;
        }
        if (siteA && siteB) {
          const dateSiteA = a.date_commande ? new Date(a.date_commande).getTime() : 0;
          const dateSiteB = b.date_commande ? new Date(b.date_commande).getTime() : 0;
          return dateSiteB - dateSiteA;
        }
      }

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
    // Mettre à jour localement immédiatement pour un feedback instantané
    const commandes = [...this.commandes()];
    const index = commandes.findIndex(c => c.id_commande === commande.id_commande);
    
    if (index !== -1) {
      const updatedCommande = { ...commandes[index] };
      
      if (this.statutsFinaux.includes(statut)) {
        // Pour les statuts finaux : retirer de statuts_actifs (marquer comme terminé)
        if (updatedCommande.statuts_actifs) {
          updatedCommande.statuts_actifs = updatedCommande.statuts_actifs.filter(s => s !== statut);
          if (updatedCommande.statuts_actifs.length === 0) {
            updatedCommande.statuts_actifs = undefined;
          }
          
          // Si tous les 4 statuts finaux sont complétés, passer à TERMINE
          const tousCompletes = this.statutsFinaux.every(s => 
            !updatedCommande.statuts_actifs || !updatedCommande.statuts_actifs.includes(s)
          );
          
          if (tousCompletes) {
            updatedCommande.statut_commande = StatutCommande.TERMINE;
            updatedCommande.statuts_actifs = undefined;
          }
        }
      } else {
        // Pour les autres statuts : passer au statut suivant dans l'ordre
        const currentIndex = this.ordreEtapes.indexOf(statut);
        if (currentIndex !== -1 && currentIndex < this.ordreEtapes.length - 1) {
          updatedCommande.statut_commande = this.ordreEtapes[currentIndex + 1];
        } else if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
          // Si on termine "À Prendre en photo", créer statuts_actifs avec les 4 statuts finaux
          updatedCommande.statuts_actifs = [...this.statutsFinaux];
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
    if (this.statutsFinaux.includes(statut)) {
      // Pour les 3 dernières colonnes, vérifier si le statut est dans statuts_actifs
      return commande.statuts_actifs?.includes(statut) || false;
    }
    
    // Pour les autres colonnes, vérifier le statut principal
    return commande.statut_commande === statut;
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
    if (this.draggedRecently) {
      return;
    }
    try {
      sessionStorage.setItem(this.detailReturnPageKey, 'en-cours');
    } catch {
      // ignorer
    }
    this.sauverScroll();
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', commande.id_commande]);
  }

  navigateToTerminees(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'terminees']);
  }

  navigateToNouvelleCommande(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'nouvelle']);
  }

  isCommandeDragging(commande: Commande): boolean {
    return this.dragCommandeId === commande.id_commande;
  }

  isFinalStatut(statut: StatutCommande): boolean {
    return this.statutsFinaux.includes(statut);
  }

  isColumnDropHighlighted(statut: StatutCommande): boolean {
    if (this.isFinalStatut(statut)) {
      return this.dragOverFinalsGroup() && this.isFinalsGroupDropValid();
    }
    return this.dragOverStatut() === statut && this.isDropTargetValid(statut);
  }

  isFinalsGroupDropValid(): boolean {
    if (!this.dragCommandeId || !this.dragSourceStatut || this.isStatutMoveInProgress) {
      return false;
    }
    // Déjà dans le bloc parallèle : pas de zone de drop verte (comme sa propre colonne linéaire)
    if (this.isFinalStatut(this.dragSourceStatut)) {
      return false;
    }
    return true;
  }

  isDropTargetValid(statut: StatutCommande): boolean {
    if (!this.dragCommandeId || !this.dragSourceStatut || this.isStatutMoveInProgress) {
      return false;
    }
    const commande = this.commandes().find(c => c.id_commande === this.dragCommandeId);
    if (!commande) {
      return false;
    }
    return this.canDropCommande(commande, this.dragSourceStatut, statut);
  }

  canDropCommande(commande: Commande, sourceStatut: StatutCommande, targetStatut: StatutCommande): boolean {
    if (sourceStatut === targetStatut) {
      return false;
    }
    if (this.isFinalStatut(sourceStatut) && this.isFinalStatut(targetStatut)) {
      return false;
    }
    if (!this.isCommandeInStatut(commande, sourceStatut)) {
      return false;
    }
    return true;
  }

  onCardPointerDown(event: PointerEvent, commande: Commande, sourceStatut: StatutCommande): void {
    if (this.isStatutMoveInProgress || event.button !== 0 || this.pointerDrag) {
      return;
    }
    if (event.pointerType === 'touch' || window.innerWidth < CommandesEnCoursPageComponent.LARGEUR_COLONNES_PX) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (this.isInteractiveDragTarget(target)) {
      return;
    }

    const captureElement = event.currentTarget as HTMLElement;
    const cardElement = captureElement.closest('.kb-card') as HTMLElement | null;
    if (!cardElement) {
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();
    this.pointerDrag = {
      commande,
      sourceStatut,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      pointerId: event.pointerId,
      captureElement,
      cardElement,
      offsetX: event.clientX - cardRect.left,
      offsetY: event.clientY - cardRect.top,
    };

    captureElement.setPointerCapture(event.pointerId);
    document.addEventListener('pointermove', this.onDocumentPointerMove, { passive: false });
    document.addEventListener('pointerup', this.onDocumentPointerUp);
    document.addEventListener('pointercancel', this.onDocumentPointerUp);
  }

  private handleDocumentPointerMove(event: PointerEvent): void {
    if (!this.pointerDrag || event.pointerId !== this.pointerDrag.pointerId) {
      return;
    }

    const dx = event.clientX - this.pointerDrag.startX;
    const dy = event.clientY - this.pointerDrag.startY;

    if (!this.pointerDrag.active) {
      if ((dx * dx) + (dy * dy) < CommandesEnCoursPageComponent.POINTER_DRAG_THRESHOLD_PX ** 2) {
        return;
      }
      this.activatePointerDrag(event.clientX, event.clientY);
    }

    event.preventDefault();
    this.pendingPointerX = event.clientX;
    this.pendingPointerY = event.clientY;
    this.scheduleDragMoveFrame();
  }

  private scheduleDragMoveFrame(): void {
    if (this.dragMoveRaf !== null) {
      return;
    }

    this.dragMoveRaf = requestAnimationFrame(() => {
      this.dragMoveRaf = null;
      this.updateDragGhostPosition(this.pendingPointerX, this.pendingPointerY);
      this.updateDropZoneFromPoint(this.pendingPointerX, this.pendingPointerY);
    });
  }

  private cancelDragMoveRaf(): void {
    if (this.dragMoveRaf !== null) {
      cancelAnimationFrame(this.dragMoveRaf);
      this.dragMoveRaf = null;
    }
  }

  private handleDocumentPointerUp(event: PointerEvent): void {
    if (!this.pointerDrag || event.pointerId !== this.pointerDrag.pointerId) {
      return;
    }

    const pending = this.pointerDrag;
    this.cancelDragMoveRaf();
    this.releasePointerCapture(pending.captureElement, pending.pointerId);
    this.cleanupPointerDragListeners();

    if (pending.active) {
      const targetStatut = this.resolveStatutFromPoint(event.clientX, event.clientY);
      this.resetDragState(true);

      if (targetStatut && !this.isStatutMoveInProgress) {
        const resolvedTarget = this.resolveDropTargetStatut(pending.sourceStatut, targetStatut);
        if (this.canDropCommande(pending.commande, pending.sourceStatut, resolvedTarget)) {
          this.moveCommandeToStatut(pending.commande, resolvedTarget);
        }
      }
    }

    this.pointerDrag = null;
    this.flushRemoteRefresh();
  }

  private activatePointerDrag(clientX: number, clientY: number): void {
    if (!this.pointerDrag || this.pointerDrag.active) {
      return;
    }

    this.pointerDrag.active = true;
    this.draggedRecently = true;
    this.dragCommandeId = this.pointerDrag.commande.id_commande;
    this.dragSourceStatut = this.pointerDrag.sourceStatut;
    this.createDragGhost();
    this.refreshColumnDropRects();
    this.lastResolvedDropStatut = null;
    this.updateDragGhostPosition(clientX, clientY);
    this.lockTableScroll(true);
    document.body.classList.add('commande-pointer-drag-active');
    this.ngZone.run(() => this.cdr.markForCheck());
  }

  private createDragGhost(): void {
    if (!this.pointerDrag) {
      return;
    }

    this.removeDragGhost();

    const source = this.pointerDrag.cardElement;
    const rect = source.getBoundingClientRect();
    const computed = getComputedStyle(source);
    const ghost = source.cloneNode(true) as HTMLElement;

    ghost.classList.add('commande-drag-ghost');
    ghost.classList.remove('is-dragging');
    ghost.setAttribute('aria-hidden', 'true');

    ghost.style.position = 'fixed';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.margin = '0';
    ghost.style.width = `${rect.width}px`;
    ghost.style.minHeight = `${rect.height}px`;
    ghost.style.boxSizing = 'border-box';
    ghost.style.animation = 'none';
    ghost.style.opacity = '1';
    ghost.style.visibility = 'visible';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '100000';
    ghost.style.transformOrigin = 'top left';
    ghost.style.backgroundColor = computed.backgroundColor;
    ghost.style.color = computed.color;
    ghost.style.border = computed.border;
    ghost.style.borderRadius = computed.borderRadius;
    ghost.style.padding = computed.padding;
    ghost.style.fontSize = computed.fontSize;
    ghost.style.lineHeight = computed.lineHeight;
    ghost.style.boxShadow = '0 20px 44px rgba(0, 0, 0, 0.28)';

    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  private updateDragGhostPosition(clientX: number, clientY: number): void {
    if (!this.dragGhost || !this.pointerDrag) {
      return;
    }

    const x = clientX - this.pointerDrag.offsetX;
    const y = clientY - this.pointerDrag.offsetY;
    this.dragGhost.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) rotate(-0.75deg) scale(1.02)`;
  }

  private removeDragGhost(): void {
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  private refreshColumnDropRects(): void {
    const board = this.boardElement?.nativeElement;
    if (!board) {
      this.columnDropRects = [];
      return;
    }

    this.columnDropRects = Array.from(
      board.querySelectorAll<HTMLElement>('.kb-col[data-statut-drop]')
    ).map(cell => {
      const rect = cell.getBoundingClientRect();
      return {
        statut: cell.dataset['statutDrop'] as StatutCommande,
        left: rect.left,
        right: rect.right,
      };
    });
  }

  private updateDropZoneFromPoint(clientX: number, clientY: number): void {
    const statut = this.resolveStatutFromPoint(clientX, clientY);
    if (statut) {
      this.setDragOverZone(statut);
      return;
    }

    if (this.dragOverStatut() !== null || this.dragOverFinalsGroup()) {
      this.lastResolvedDropStatut = null;
      this.ngZone.run(() => {
        this.dragOverStatut.set(null);
        this.dragOverFinalsGroup.set(false);
      });
    }
  }

  private resolveStatutFromPoint(clientX: number, clientY: number): StatutCommande | null {
    if (this.columnDropRects.length === 0) {
      return null;
    }

    let hit: StatutCommande | null = null;
    for (const col of this.columnDropRects) {
      if (clientX >= col.left && clientX < col.right) {
        hit = col.statut;
        break;
      }
    }

    if (!hit) {
      return null;
    }

    if (this.lastResolvedDropStatut && hit !== this.lastResolvedDropStatut) {
      const prev = this.columnDropRects.find(c => c.statut === this.lastResolvedDropStatut);
      const next = this.columnDropRects.find(c => c.statut === hit);
      if (prev && next) {
        const movingRight = next.left >= prev.left;
        const edge = movingRight ? next.left : next.right;
        if (Math.abs(clientX - edge) < CommandesEnCoursPageComponent.COLUMN_SWITCH_HYSTERESIS_PX) {
          return this.lastResolvedDropStatut;
        }
      }
    }

    this.lastResolvedDropStatut = hit;
    return hit;
  }

  private isInteractiveDragTarget(target: HTMLElement | null): boolean {
    return !!target?.closest(
      'input, button, a, .kb-card__foot, .kb-fin'
    );
  }

  private releasePointerCapture(element: HTMLElement, pointerId: number): void {
    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  }

  private cleanupPointerDragListeners(): void {
    document.removeEventListener('pointermove', this.onDocumentPointerMove);
    document.removeEventListener('pointerup', this.onDocumentPointerUp);
    document.removeEventListener('pointercancel', this.onDocumentPointerUp);
  }

  private resetDragState(markDraggedRecently: boolean): void {
    this.cancelDragMoveRaf();
    this.removeDragGhost();
    this.columnDropRects = [];
    this.lastResolvedDropStatut = null;
    this.lockTableScroll(false);
    document.body.classList.remove('commande-pointer-drag-active');
    this.ngZone.run(() => {
      this.dragCommandeId = null;
      this.dragSourceStatut = null;
      this.dragOverStatut.set(null);
      this.dragOverFinalsGroup.set(false);
    });

    if (markDraggedRecently) {
      setTimeout(() => {
        this.draggedRecently = false;
      }, 150);
    }
    this.flushRemoteRefresh();
  }

  private flushRemoteRefresh(): void {
    if (!this.refreshEnAttente || this.pointerDrag || this.dragCommandeId) {
      return;
    }
    this.refreshEnAttente = false;
    this.loadCommandes(true);
  }

  private resolveDropTargetStatut(sourceStatut: StatutCommande, targetStatut: StatutCommande): StatutCommande {
    if (!this.isFinalStatut(targetStatut)) {
      return targetStatut;
    }
    if (!this.isFinalStatut(sourceStatut)) {
      return this.firstFinalStatut;
    }
    return targetStatut;
  }

  private setDragOverZone(statut: StatutCommande): void {
    this.ngZone.run(() => {
      if (this.isFinalStatut(statut)) {
        if (!this.dragOverFinalsGroup()) {
          this.dragOverFinalsGroup.set(true);
          this.dragOverStatut.set(null);
        }
        return;
      }

      if (this.dragOverFinalsGroup()) {
        this.dragOverFinalsGroup.set(false);
      }

      if (this.dragOverStatut() !== statut) {
        this.dragOverStatut.set(statut);
      }
    });
  }

  private lockTableScroll(locked: boolean): void {
    this.boardElement?.nativeElement.classList.toggle('is-drag', locked);
  }

  private buildTargetStateForStatut(targetStatut: StatutCommande): Pick<Commande, 'statut_commande' | 'statuts_actifs'> {
    const targetIdx = this.statuts.indexOf(targetStatut);

    if (targetIdx <= 4) {
      return {
        statut_commande: targetStatut,
        statuts_actifs: undefined,
      };
    }

    const desiredActifs = this.statutsFinaux.slice(targetIdx - 5);
    if (desiredActifs.length === 0) {
      return {
        statut_commande: StatutCommande.TERMINE,
        statuts_actifs: undefined,
      };
    }

    return {
      statut_commande: StatutCommande.A_PRENDRE_EN_PHOTO,
      statuts_actifs: desiredActifs,
    };
  }

  private buildApiCallsForMove(commande: Commande, targetStatut: StatutCommande): StatutCommande[] {
    const targetIdx = this.statuts.indexOf(targetStatut);
    const calls: StatutCommande[] = [];
    const hasActifs = (commande.statuts_actifs?.length ?? 0) > 0;

    if (targetIdx <= 4) {
      calls.push(targetStatut);
      return calls;
    }

    const desiredActifs = this.statutsFinaux.slice(targetIdx - 5);

    if (!hasActifs) {
      if (commande.statut_commande !== StatutCommande.A_PRENDRE_EN_PHOTO) {
        calls.push(StatutCommande.A_PRENDRE_EN_PHOTO);
      }
      calls.push(StatutCommande.A_PRENDRE_EN_PHOTO);
    }

    let simulatedActifs = hasActifs ? [...(commande.statuts_actifs ?? [])] : [...this.statutsFinaux];

    for (const final of this.statutsFinaux) {
      if (!desiredActifs.includes(final) && simulatedActifs.includes(final)) {
        calls.push(final);
        simulatedActifs = simulatedActifs.filter(s => s !== final);
      }
    }

    for (const final of this.statutsFinaux) {
      if (desiredActifs.includes(final) && !simulatedActifs.includes(final)) {
        calls.push(final);
        simulatedActifs.push(final);
      }
    }

    return calls;
  }

  private moveCommandeToStatut(commande: Commande, targetStatut: StatutCommande): void {
    const apiCalls = this.buildApiCallsForMove(commande, targetStatut);
    if (apiCalls.length === 0) {
      return;
    }

    const targetState = this.buildTargetStateForStatut(targetStatut);
    const commandes = [...this.commandes()];
    const index = commandes.findIndex(c => c.id_commande === commande.id_commande);

    if (index !== -1) {
      commandes[index] = {
        ...commandes[index],
        ...targetState,
      };
      this.commandes.set(commandes);
    }

    this.isStatutMoveInProgress = true;

    from(apiCalls).pipe(
      concatMap(statut =>
        this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
          id_commande: commande.id_commande,
          statut,
        })
      ),
      last()
    ).subscribe({
      next: (response) => {
        if (response?.result && response?.data) {
          const updated = [...this.commandes()];
          const idx = updated.findIndex(c => c.id_commande === commande.id_commande);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], ...response.data };
            this.commandes.set(updated);
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du déplacement de la commande:', error);
        this.isStatutMoveInProgress = false;
        this.loadCommandes();
      },
      complete: () => {
        this.isStatutMoveInProgress = false;
        this.loadCommandes();
      },
    });
  }
}
