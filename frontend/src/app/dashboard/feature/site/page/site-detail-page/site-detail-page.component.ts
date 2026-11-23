import { Component, DestroyRef, HostListener, NgZone, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '@shared';
import { RealtimeService } from '@api';
import { SiteApiService } from '../../service/site-api.service';
import { CATEGORIES_SITE, SiteItem, SiteType } from '../../model/site.interface';

/** Champs de `donnees` gérés par le formulaire ; les autres vont dans « Champs avancés ». */
const CHAMPS_FORMULAIRE = ['price', 'material', 'dimensions', 'description', 'keywords', 'features', 'inStock', 'customizable', 'client'];

export interface Fiche {
  nom: string;
  slug: string;
  type: SiteType;
  categories: string[];
  visible: boolean;
  prix: string;
  materiau: string;
  dimensions: string;
  description: string;
  motsCles: string;
  caracteristiques: string;
  enStock: boolean;
  personnalisable: boolean;
  client: string;
  avance: string;
}

/** Rubriques suivies pour détecter « non enregistré » et fusionner avec une version reçue. */
const UNITES: { cle: keyof Fiche; label: string; produit?: boolean; projet?: boolean }[] = [
  { cle: 'nom', label: 'Nom' },
  { cle: 'slug', label: 'Adresse (slug)' },
  { cle: 'categories', label: 'Catégories' },
  { cle: 'visible', label: 'Visible sur le site' },
  { cle: 'prix', label: 'Prix affiché' },
  { cle: 'materiau', label: 'Matériau' },
  { cle: 'dimensions', label: 'Dimensions' },
  { cle: 'client', label: 'Client', projet: true },
  { cle: 'description', label: 'Description' },
  { cle: 'caracteristiques', label: 'Caractéristiques' },
  { cle: 'motsCles', label: 'Mots-clés' },
  { cle: 'enStock', label: 'En stock', produit: true },
  { cle: 'personnalisable', label: 'Personnalisable', produit: true },
  { cle: 'avance', label: 'Champs avancés' },
];

export interface ConflitFiche {
  cle: keyof Fiche;
  label: string;
  mienne: string;
  recue: string;
}

const valeurUnite = (f: Fiche, cle: keyof Fiche): string => {
  const v = f[cle];
  return Array.isArray(v) ? JSON.stringify([...v].sort()) : typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v ?? '');
};
const texteUnite = (f: Fiche, cle: keyof Fiche): string => {
  const v = f[cle];
  if (Array.isArray(v)) return v.length ? v.join(', ') : '(vide)';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  return String(v ?? '').trim() || '(vide)';
};
const instantane = (f: Fiche): Record<string, string> => Object.fromEntries(UNITES.map((u) => [u.cle, valeurUnite(f, u.cle)]));

@Component({
  selector: 'app-site-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, HeaderComponent],
  templateUrl: './site-detail-page.component.html',
  styleUrl: './site-detail-page.component.scss',
})
export class SiteDetailPageComponent implements OnInit, OnDestroy {
  private static readonly DELAI_SORTIE_AUTO_MS = 3 * 60 * 1000;

  private readonly api = inject(SiteApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);

  readonly item = signal<SiteItem | null>(null);
  readonly nouveau = signal(false);
  readonly isEditMode = signal(false);
  readonly loading = signal(true);
  readonly erreur = signal('');
  readonly enCours = signal(false);
  readonly nonEnregistre = signal(false);
  readonly message = signal('');
  readonly notice = signal<string | null>(null);
  readonly majIntegrees = signal<string[]>([]);
  readonly conflits = signal<ConflitFiche[]>([]);
  readonly onglet = signal<'infos' | 'photos' | 'site'>('infos');
  readonly nouvelleCategorie = signal('');
  readonly fiche = signal<Fiche>(this.ficheVide('produit'));

  readonly categoriesProposees = computed(() => CATEGORIES_SITE[this.fiche().type]);
  /** Catégories de la fiche qui ne font pas partie des catégories habituelles du site. */
  readonly categoriesAutres = computed(() => this.fiche().categories.filter((c) => !CATEGORIES_SITE[this.fiche().type].some((p) => p.valeur === c)));

  /** Copie de la fiche telle qu'ouverte (ou reçue en dernier) : sert de point de comparaison. */
  private base: Record<string, string> | null = null;
  /** Version (date_maj) du serveur sur laquelle repose ma modification. */
  private versionBase: string | null = null;
  private ficheRecue: Fiche | null = null;
  private derniereActivite = Date.now();
  private derniereVerifRetour = 0;
  private fusionEnCours = false;
  private veille: ReturnType<typeof setInterval> | null = null;
  private timerIntegrees: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // La page peut passer d'une collection à l'un de ses modèles sans être recréée : on suit l'adresse.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => this.ouvrirFiche(p.get('id')));

    this.realtime
      .on('site')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => this.onChangementDistant(e));
    this.zone.runOutsideAngular(() => (this.veille = setInterval(() => this.veiller(), 2000)));
  }

  private ouvrirFiche(id: string | null): void {
    this.item.set(null);
    this.erreur.set('');
    this.notice.set(null);
    this.isEditMode.set(false);
    this.conflits.set([]);
    this.nonEnregistre.set(false);
    this.base = null;
    if (id === 'nouveau') {
      const type = this.route.snapshot.queryParamMap.get('type') === 'projet' ? 'projet' : 'produit';
      this.fiche.set(this.ficheVide(type));
      this.nouveau.set(true);
      this.isEditMode.set(true);
      this.loading.set(false);
      return;
    }
    this.nouveau.set(false);
    this.loading.set(true);
    this.api.obtenir(id!).subscribe((i) => {
      this.loading.set(false);
      if (!i) this.erreur.set('Fiche introuvable.');
      else this.charger(i);
    });
  }

  ngOnDestroy(): void {
    if (this.veille) clearInterval(this.veille);
    if (this.timerIntegrees) clearTimeout(this.timerIntegrees);
  }

  // ---------- Chargement ----------

  private ficheVide(type: SiteType): Fiche {
    return { nom: '', slug: '', type, categories: [], visible: true, prix: '', materiau: '', dimensions: '', description: '', motsCles: '', caracteristiques: '', enStock: true, personnalisable: false, client: '', avance: '' };
  }

  private ficheDepuis(i: SiteItem): Fiche {
    const d = i.donnees ?? {};
    const reste = Object.fromEntries(Object.entries(d).filter(([k]) => !CHAMPS_FORMULAIRE.includes(k)));
    return {
      nom: i.nom,
      slug: i.slug,
      type: i.type,
      categories: [...i.categories],
      visible: i.visible,
      prix: d['price'] ?? '',
      materiau: d['material'] ?? '',
      dimensions: d['dimensions'] ?? '',
      description: d['description'] ?? '',
      motsCles: (d['keywords'] ?? []).join(', '),
      caracteristiques: (d['features'] ?? []).join('\n'),
      enStock: d['inStock'] !== false,
      personnalisable: !!d['customizable'],
      client: d['client'] ?? '',
      avance: Object.keys(reste).length ? JSON.stringify(reste, null, 2) : '',
    };
  }

  /** Affiche une version du serveur et repart de zéro (aucune modification en cours). */
  private charger(i: SiteItem): void {
    this.item.set(i);
    this.fiche.set(this.ficheDepuis(i));
    this.base = null;
    this.versionBase = i.date_maj;
    this.ficheRecue = null;
    this.conflits.set([]);
    this.majIntegrees.set([]);
    this.nonEnregistre.set(false);
  }

  // ---------- Mode lecture / modification ----------

  modifier(): void {
    this.isEditMode.set(true);
    this.prendreBase();
    this.notice.set(null);
    this.erreur.set('');
  }

  annuler(): void {
    if (this.unitesModifiees().length > 0 && !confirm('Annuler les modifications non enregistrées ?')) return;
    this.refermerModification();
  }

  private refermerModification(): void {
    const i = this.item();
    this.isEditMode.set(false);
    if (!i) return;
    // On repart de la version du serveur : toutes les modifications non enregistrées disparaissent.
    this.api.obtenir(i.id).subscribe((maj) => (maj ? this.charger(maj) : this.charger(i)));
  }

  private prendreBase(): void {
    this.base = instantane(this.fiche());
    this.derniereActivite = Date.now();
  }

  private unitesActives() {
    const type = this.fiche().type;
    return UNITES.filter((u) => (u.produit ? type === 'produit' : u.projet ? type === 'projet' : true));
  }

  private unitesModifiees(): (typeof UNITES)[number][] {
    if (!this.isEditMode()) return [];
    if (this.nouveau()) return this.fiche().nom.trim() ? this.unitesActives() : [];
    if (!this.base) return [];
    const mien = instantane(this.fiche());
    return this.unitesActives().filter((u) => mien[u.cle] !== this.base![u.cle]);
  }

  // ---------- Suivi : « Non enregistré », fermeture automatique, retour sur la page ----------

  /** Toutes les 2 s : tient à jour la pastille « Non enregistré » et referme une modification oubliée. */
  private veiller(): void {
    if (!this.item() || !this.isEditMode() || this.nouveau()) {
      if (this.nonEnregistre()) this.zone.run(() => this.nonEnregistre.set(false));
      return;
    }
    if (!this.base) this.prendreBase();
    const modifie = this.unitesModifiees().length > 0;
    if (modifie !== this.nonEnregistre()) this.zone.run(() => this.nonEnregistre.set(modifie));
    const inactif = Date.now() - this.derniereActivite > SiteDetailPageComponent.DELAI_SORTIE_AUTO_MS;
    if (!modifie && inactif && this.conflits().length === 0 && !this.enCours()) {
      this.zone.run(() => {
        this.refermerModification();
        this.notice.set("Mode modification refermé : rien n'avait été changé.");
      });
    }
  }

  @HostListener('document:input')
  @HostListener('document:pointerdown')
  noterActivite(): void {
    this.derniereActivite = Date.now();
  }

  /** Retour sur l'onglet ou la fenêtre : on revérifie la fiche (le flux temps réel a pu dormir). */
  @HostListener('document:visibilitychange')
  @HostListener('window:focus')
  onRetourSurLaPage(): void {
    const i = this.item();
    if (document.visibilityState !== 'visible' || !i || this.loading() || Date.now() - this.derniereVerifRetour < 10000) return;
    this.derniereVerifRetour = Date.now();
    this.onChangementDistant({ action: 'updated', id: i.id });
  }

  /** Fermeture ou rechargement de la page avec des changements non enregistrés. */
  @HostListener('window:beforeunload', ['$event'])
  avertirAvantDeQuitter(event: BeforeUnloadEvent): void {
    if (this.unitesModifiees().length > 0) event.preventDefault();
  }

  /** Changement de page dans l'app (garde de route). */
  peutQuitter(): boolean {
    if (this.unitesModifiees().length === 0) return true;
    return window.confirm('Des modifications ne sont pas enregistrées sur cette fiche. Quitter sans enregistrer ?');
  }

  // ---------- Modification faite ailleurs pendant que la page est ouverte ----------

  private onChangementDistant(event: { action: string; id?: string }): void {
    const i = this.item();
    if (!i || (event.id && event.id !== i.id)) return;
    if (event.action === 'deleted') {
      this.isEditMode.set(false);
      this.router.navigate(i.parent_id ? ['/dashboard', 'site', i.parent_id] : ['/dashboard', 'site']);
      return;
    }
    if (!this.isEditMode()) {
      this.api.obtenir(i.id).subscribe((maj) => maj && this.charger(maj));
      return;
    }
    this.fusionnerDistante();
  }

  /**
   * La fiche a changé ailleurs pendant que je la modifie : on recharge la version du serveur et on fusionne.
   * Ce que je n'ai pas touché prend la version reçue ; ce que j'ai touché est gardé ;
   * ce qui a changé des deux côtés devient un conflit à trancher. Les photos suivent toujours le serveur.
   */
  private fusionnerDistante(apres?: () => void): void {
    const i = this.item();
    if (!i || this.fusionEnCours) return;
    this.fusionEnCours = true;
    this.api.obtenir(i.id).subscribe((distante) => {
      this.fusionEnCours = false;
      if (!distante) return;
      if (!this.isEditMode()) {
        this.charger(distante);
        return;
      }
      this.appliquerFusion(distante);
      apres?.();
    });
  }

  private appliquerFusion(distante: SiteItem): void {
    const mienne = this.fiche();
    const recue = this.ficheDepuis(distante);
    const mien = instantane(mienne);
    const recu = instantane(recue);
    const base = this.base ?? mien;
    const integrees: string[] = [];
    const conflits: ConflitFiche[] = [];
    let resultat: Fiche = { ...mienne };

    for (const u of this.unitesActives()) {
      const dejaEnConflit = this.conflits().find((c) => c.cle === u.cle);
      if (mien[u.cle] === recu[u.cle]) continue; // même valeur des deux côtés
      if (recu[u.cle] === base[u.cle]) {
        // Rien de neuf côté serveur ; un conflit encore ouvert le reste.
        if (dejaEnConflit) conflits.push({ ...dejaEnConflit, recue: texteUnite(recue, u.cle) });
        continue;
      }
      if (mien[u.cle] === base[u.cle] && !dejaEnConflit) {
        resultat = { ...resultat, [u.cle]: recue[u.cle] };
        integrees.push(u.label);
      } else {
        conflits.push({ cle: u.cle, label: u.label, mienne: texteUnite(mienne, u.cle), recue: texteUnite(recue, u.cle) });
      }
    }

    this.item.set(distante); // photos, date de modification : toujours celles du serveur
    this.fiche.set(resultat);
    this.base = recu;
    this.versionBase = distante.date_maj;
    this.ficheRecue = recue;
    this.conflits.set(conflits);
    if (integrees.length) {
      this.majIntegrees.set(integrees);
      if (this.timerIntegrees) clearTimeout(this.timerIntegrees);
      this.timerIntegrees = setTimeout(() => this.majIntegrees.set([]), 15000);
    }
    this.derniereActivite = Date.now();
  }

  /** Conflit : je garde ce que j'ai tapé (ce sera enregistré par-dessus la version reçue). */
  garderMaVersion(c: ConflitFiche): void {
    this.conflits.update((l) => l.filter((x) => x.cle !== c.cle));
  }

  /** Conflit : je prends la version reçue à la place de la mienne. */
  prendreLaVersionRecue(c: ConflitFiche): void {
    if (this.ficheRecue) this.fiche.update((f) => ({ ...f, [c.cle]: this.ficheRecue![c.cle] }));
    this.conflits.update((l) => l.filter((x) => x.cle !== c.cle));
  }

  // ---------- Formulaire ----------

  libelle(valeur: string): string {
    const c = [...CATEGORIES_SITE.produit, ...CATEGORIES_SITE.projet].find((x) => x.valeur === valeur);
    return c ? c.label : valeur;
  }

  maj<K extends keyof Fiche>(cle: K, valeur: Fiche[K]): void {
    this.fiche.update((f) => ({ ...f, [cle]: valeur }));
  }

  retirerCategorie(c: string): void {
    this.maj('categories', this.fiche().categories.filter((x) => x !== c));
  }

  basculerCategorie(c: string): void {
    this.fiche().categories.includes(c) ? this.retirerCategorie(c) : this.maj('categories', [...this.fiche().categories, c]);
  }

  ajouterCategorie(c: string): void {
    const v = c.trim();
    if (v && !this.fiche().categories.includes(v)) this.maj('categories', [...this.fiche().categories, v]);
    this.nouvelleCategorie.set('');
  }

  /** Adresse de la fiche sur le site vitrine. */
  lienSite(): string {
    const i = this.item();
    if (!i) return '';
    return i.type === 'produit' ? `https://www.gravisterie.be/boutique?product=${i.slug}` : `https://www.gravisterie.be/projets?project=${i.slug}`;
  }

  texte(cle: keyof Fiche): string {
    return texteUnite(this.fiche(), cle);
  }

  private donnees(): Record<string, any> | null {
    const f = this.fiche();
    let avance: Record<string, any> = {};
    if (f.avance.trim()) {
      try {
        avance = JSON.parse(f.avance);
        if (!avance || typeof avance !== 'object' || Array.isArray(avance)) throw new Error();
      } catch {
        this.erreur.set('Les champs avancés ne sont pas un JSON valide.');
        return null;
      }
    }
    const d: Record<string, any> = { ...avance };
    if (f.prix.trim()) d['price'] = f.prix.trim();
    if (f.materiau.trim()) d['material'] = f.materiau.trim();
    if (f.dimensions.trim()) d['dimensions'] = f.dimensions.trim();
    d['description'] = f.description.trim();
    d['keywords'] = f.motsCles.split(',').map((m) => m.trim()).filter(Boolean);
    d['features'] = f.caracteristiques.split('\n').map((m) => m.trim()).filter(Boolean);
    if (f.type === 'produit' && !this.item()?.parent) {
      d['inStock'] = f.enStock;
      d['customizable'] = f.personnalisable;
    } else if (f.client.trim()) d['client'] = f.client.trim();
    return d;
  }

  /**
   * Enregistre la fiche. Si elle a changé ailleurs entre-temps, le serveur refuse : on fusionne alors
   * avec la version reçue et on réessaie une fois s'il n'y a aucun conflit à trancher.
   */
  enregistrer(reessai = false): void {
    const f = this.fiche();
    this.erreur.set('');
    if (this.conflits().length > 0 || this.enCours()) return;
    if (!f.nom.trim()) {
      this.erreur.set('Le nom est obligatoire.');
      return;
    }
    const donnees = this.donnees();
    if (!donnees) return;
    const courant = this.item();
    const payload = { type: f.type, nom: f.nom, slug: f.slug || undefined, categories: f.categories, visible: f.visible, donnees };
    this.enCours.set(true);

    if (!courant) {
      this.api.creerBrut(payload).subscribe((r) => {
        this.enCours.set(false);
        if (!r.result || !r.data) {
          this.erreur.set((r as any).message || "L'enregistrement a échoué.");
          return;
        }
        const maj = r.data as SiteItem;
        this.nouveau.set(false);
        this.isEditMode.set(false);
        this.charger(maj);
        this.router.navigate(['/dashboard', 'site', maj.id], { replaceUrl: true });
        this.signaler('Fiche créée.');
      });
      return;
    }

    this.api.modifierBrut(courant.id, { ...payload, base: this.versionBase ?? undefined }).subscribe((r) => {
      this.enCours.set(false);
      if (r.result && r.data) {
        this.isEditMode.set(false);
        this.charger(this.avecLiens(r.data as SiteItem));
        this.signaler('Enregistré. Le site se met à jour dans quelques secondes.');
        return;
      }
      if ((r.code as unknown as string) === 'site.conflit') {
        this.fusionnerDistante(() => {
          if (this.conflits().length > 0) {
            this.erreur.set('La fiche a été modifiée ailleurs : choisis la version à garder pour chaque champ en conflit.');
          } else if (!reessai) {
            this.enregistrer(true);
          } else {
            this.erreur.set('La fiche vient encore de changer. Vérifie les champs puis enregistre à nouveau.');
          }
        });
        return;
      }
      this.erreur.set((r as any).message || "L'enregistrement a échoué.");
    });
  }

  supprimer(): void {
    const i = this.item();
    const nb = i?.enfants?.length ?? 0;
    if (!i || !confirm(`Supprimer « ${i.nom} » du site${nb ? ` avec ses ${nb} modèles` : ''} ? Les photos seront aussi supprimées.`)) return;
    this.isEditMode.set(false);
    this.api.supprimer(i.id).subscribe((ok) => {
      if (ok) this.router.navigate(i.parent_id ? ['/dashboard', 'site', i.parent_id] : ['/dashboard', 'site']);
      else {
        this.isEditMode.set(this.nonEnregistre());
        this.erreur.set('Suppression impossible.');
      }
    });
  }

  private signaler(texte: string): void {
    this.message.set(texte);
    setTimeout(() => this.message.set(''), 4000);
  }

  // ---------- Modèles d'une collection ----------

  /** Une fiche est une collection si elle a des modèles ou si elle est marquée comme telle. */
  estCollection(): boolean {
    const i = this.item();
    return !!i && !i.parent && ((i.enfants?.length ?? 0) > 0 || i.donnees?.['kind'] === 'collection');
  }

  ajouterModele(): void {
    const i = this.item();
    if (!i) return;
    const nom = window.prompt(`Nom du nouveau modèle dans « ${i.nom} » :`)?.trim();
    if (!nom) return;
    this.api.creer({ parent_id: i.id, nom, donnees: { price: i.donnees?.['price'] ?? '', features: [], keywords: [], description: '' } }).subscribe((maj) => {
      if (maj) this.router.navigate(['/dashboard', 'site', maj.id]);
      else this.erreur.set('Création du modèle impossible.');
    });
  }

  readonly modeleGlisse = signal<string | null>(null);
  readonly modeleCible = signal<string | null>(null);

  debutGlisserModele(e: SiteItem, event: DragEvent): void {
    this.modeleGlisse.set(e.id);
    event.dataTransfer?.setData('text/plain', e.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  survolModele(e: SiteItem, event: DragEvent): void {
    if (!this.modeleGlisse() || this.modeleGlisse() === e.id) return;
    event.preventDefault();
    this.modeleCible.set(e.id);
  }

  finGlisserModele(): void {
    this.modeleGlisse.set(null);
    this.modeleCible.set(null);
  }

  /** Glisser un modèle sur un autre change l'ordre dans la collection, enregistré tout de suite. */
  deposerModele(e: SiteItem, event: DragEvent): void {
    event.preventDefault();
    const source = this.modeleGlisse();
    this.finGlisserModele();
    const i = this.item();
    if (!i?.enfants || !source || source === e.id) return;
    const liste = [...i.enfants];
    const depuis = liste.findIndex((x) => x.id === source);
    const vers = liste.findIndex((x) => x.id === e.id);
    if (depuis < 0 || vers < 0) return;
    const [deplace] = liste.splice(depuis, 1);
    liste.splice(vers, 0, deplace);
    this.item.set({ ...i, enfants: liste });
    this.api.ordre(liste.map((x) => x.id)).subscribe((ok) => {
      if (!ok) this.erreur.set("L'ordre n'a pas pu être enregistré.");
    });
  }

  vignette(u: string | undefined): string {
    return u ? this.miniature(u) : '';
  }

  /** Les réponses d'écriture ne contiennent pas les modèles ni la collection parente : on garde ceux déjà chargés. */
  private avecLiens(maj: SiteItem): SiteItem {
    const actuel = this.item();
    return { ...maj, enfants: maj.enfants ?? actuel?.enfants, parent: maj.parent ?? actuel?.parent };
  }

  // ---------- Photos (enregistrées tout de suite, uniquement en mode modification) ----------

  /** Une opération sur les photos produit la nouvelle version de la fiche : on s'y appuie pour la suite. */
  private appliquerPhotos(maj: SiteItem): void {
    this.item.set(this.avecLiens(maj));
    this.versionBase = maj.date_maj;
  }

  ajouterPhotos(event: Event): void {
    const input = event.target as HTMLInputElement;
    const i = this.item();
    const fichiers = Array.from(input.files ?? []);
    if (!i || !fichiers.length) return;
    this.enCours.set(true);
    this.api.ajouterImages(i.id, fichiers).subscribe((maj) => {
      this.enCours.set(false);
      input.value = '';
      if (maj) this.appliquerPhotos(maj);
      else this.erreur.set("L'envoi des photos a échoué.");
    });
  }

  retirerPhoto(index: number): void {
    const i = this.item();
    if (!i || !confirm('Retirer cette photo ?')) return;
    this.api.definirImages(i.id, i.images.filter((_, n) => n !== index)).subscribe((maj) => maj && this.appliquerPhotos(maj));
  }

  deplacerPhoto(index: number, sens: -1 | 1): void {
    const i = this.item();
    const cible = index + sens;
    if (!i || cible < 0 || cible >= i.images.length) return;
    const liste = [...i.images];
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    this.api.definirImages(i.id, liste).subscribe((maj) => maj && this.appliquerPhotos(maj));
  }

  photoPrincipale(index: number): void {
    const i = this.item();
    if (!i || index === 0) return;
    this.api.definirImages(i.id, [i.images[index], ...i.images.filter((_, n) => n !== index)]).subscribe((maj) => maj && this.appliquerPhotos(maj));
  }

  miniature(u: string): string {
    return u.replace(/\.webp$/, '-sm.webp');
  }
}
