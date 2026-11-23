import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { SiteStatutComponent } from '../../component/site-statut/site-statut.component';
import { SiteApiService } from '../../service/site-api.service';
import { CATEGORIES_SITE, SiteItem, SiteType } from '../../model/site.interface';

@Component({
  selector: 'app-site-page',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SiteStatutComponent],
  templateUrl: './site-page.component.html',
  styleUrl: './site-page.component.scss',
})
export class SitePageComponent implements OnInit {
  private readonly api = inject(SiteApiService);
  private readonly router = inject(Router);

  readonly items = signal<SiteItem[]>([]);
  readonly loading = signal(true);
  readonly erreur = signal('');
  readonly vue = signal<SiteType>('produit');
  readonly categorie = signal('toutes');
  readonly recherche = signal('');
  readonly selection = signal<Set<string>>(new Set());
  readonly publication = signal<string>('');

  readonly lotCategorie = signal('');

  readonly afficherModeles = signal(false);
  /** Fiche à laquelle appartient un modèle (collection), par id. */
  private readonly parents = computed(() => new Map(this.items().map((i) => [i.id, i])));

  /** Produits et projets de la vue, chaque collection suivie de ses modèles, dans l'ordre d'affichage du site. */
  readonly courants = computed(() => {
    const type = this.vue();
    const parOrdre = (a: SiteItem, b: SiteItem) => a.ordre - b.ordre || a.nom.localeCompare(b.nom);
    const tous = this.items().filter((i) => i.type === type);
    const enfants = new Map<string, SiteItem[]>();
    for (const e of tous.filter((i) => i.parent_id)) enfants.set(e.parent_id!, [...(enfants.get(e.parent_id!) ?? []), e]);
    const sequence: SiteItem[] = [];
    for (const p of tous.filter((i) => !i.parent_id).sort(parOrdre)) {
      sequence.push(p);
      // Les modèles sont masqués par défaut, mais une recherche les retrouve quand même.
      if (this.afficherModeles() || this.recherche().trim()) sequence.push(...(enfants.get(p.id) ?? []).sort(parOrdre));
    }
    return sequence;
  });
  readonly nbModeles = computed(() => this.items().filter((i) => !!i.parent_id).length);
  readonly nbProduits = computed(() => this.items().filter((i) => i.type === 'produit' && !i.parent_id).length);
  readonly nbProjets = computed(() => this.items().filter((i) => i.type === 'projet' && !i.parent_id).length);

  /** Catégories de la vue : connues + celles réellement utilisées. */
  readonly categoriesVue = computed(() => {
    const connues = CATEGORIES_SITE[this.vue()].map((c) => c.valeur);
    const utilisees = this.courants().flatMap((i) => this.categoriesDe(i));
    return [...new Set([...connues, ...utilisees])];
  });

  /** Un modèle prend les catégories de sa collection. */
  categoriesDe(i: SiteItem): string[] {
    return i.parent_id ? (this.parents().get(i.parent_id)?.categories ?? []) : i.categories;
  }

  collectionDe(i: SiteItem): string {
    return i.parent_id ? (this.parents().get(i.parent_id)?.nom ?? '') : '';
  }

  readonly visibles = computed(() => {
    const cat = this.categorie();
    const q = this.recherche().trim().toLowerCase();
    return this.courants().filter(
      (i) =>
        (cat === 'toutes' || this.categoriesDe(i).includes(cat)) &&
        (!q || i.nom.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q)),
    );
  });

  /**
   * Pagination du site, selon le filtre de catégorie choisi (comme sur gravisterie.be) :
   * 12 fiches par page ; en boutique sur « Toutes », la page 1 n'en montre que 9 car le bloc Gravitag prend 3 places ;
   * en projets, « Gravures & Expérimentations » est ajouté à la fin de la page 1 sans compter dans les 12.
   * Les fiches masquées et les modèles de collection n'ont pas de page.
   */
  readonly pagesSite = computed(() => {
    const cat = this.categorie();
    const produit = this.vue() === 'produit';
    const taille = 12;
    const sur = this.courants().filter((i) => !i.parent_id && i.visible && (cat === 'toutes' || i.categories.includes(cat)));
    const speciale = produit ? null : sur.find((i) => i.slug === 'badges-gravures') ?? null;
    const normales = sur.filter((i) => i !== speciale);
    const premiere = produit && cat === 'toutes' ? taille - 3 : taille;
    const pages = new Map<string, { page: number; note?: string }>();
    normales.forEach((i, r) => pages.set(i.id, { page: r < premiere ? 1 : 2 + Math.floor((r - premiere) / taille) }));
    if (speciale) pages.set(speciale.id, { page: 1, note: 'ajouté en fin de page 1' });
    const nb = normales.length ? (pages.get(normales[normales.length - 1].id)?.page ?? 1) : speciale ? 1 : 0;
    return { pages, nb, gravitag: produit && cat === 'toutes' };
  });

  /** Cartes affichées, avec le numéro de page du site et le repère de début de page. */
  readonly affichage = computed(() => {
    const { pages } = this.pagesSite();
    const recherche = !!this.recherche().trim();
    let derniere = 0;
    return this.visibles().map((i) => {
      const info = i.parent_id ? undefined : pages.get(i.id);
      const debut = !recherche && !!info && info.page !== derniere && !info.note;
      if (debut && info) derniere = info.page;
      return { i, page: info?.page ?? null, note: info?.note ?? null, debut };
    });
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.api.liste().subscribe((liste) => {
      this.loading.set(false);
      if (liste) this.items.set(liste);
      else this.erreur.set('Impossible de charger les fiches du site.');
    });
  }

  libelle(valeur: string): string {
    const c = [...CATEGORIES_SITE.produit, ...CATEGORIES_SITE.projet].find((x) => x.valeur === valeur);
    return c ? c.label : valeur;
  }

  changerVue(v: SiteType): void {
    this.vue.set(v);
    this.categorie.set('toutes');
    this.selection.set(new Set());
  }

  compte(cat: string): number {
    return cat === 'toutes' ? this.courants().length : this.courants().filter((i) => this.categoriesDe(i).includes(cat)).length;
  }

  vignette(i: SiteItem): string {
    const u = i.imagesUrl?.[0];
    return u ? u.replace(/\.webp$/, '-sm.webp') : '';
  }

  // ---------- Sélection et actions groupées ----------

  basculer(i: SiteItem): void {
    const s = new Set(this.selection());
    s.has(i.id) ? s.delete(i.id) : s.add(i.id);
    this.selection.set(s);
  }

  toutSelectionner(): void {
    const ids = this.visibles().map((i) => i.id);
    this.selection.set(this.selection().size === ids.length ? new Set() : new Set(ids));
  }

  ajouterCategorieAuLot(): void {
    const cat = this.lotCategorie().trim();
    if (!cat) return;
    this.modifierLot((i) => ({ categories: [...new Set([...i.categories, cat])] }));
    this.lotCategorie.set('');
  }

  deplacerLot(): void {
    const cat = this.lotCategorie().trim();
    if (!cat) return;
    this.modifierLot(() => ({ categories: [cat] }));
    this.lotCategorie.set('');
  }

  masquerLot(visible: boolean): void {
    this.modifierLot(() => ({ visible }));
  }

  private modifierLot(f: (i: SiteItem) => Partial<SiteItem>): void {
    const cibles = this.items().filter((i) => this.selection().has(i.id));
    let restant = cibles.length;
    cibles.forEach((i) => {
      this.api.modifier(i.id, f(i) as any).subscribe((maj) => {
        if (maj) this.remplacer(maj);
        if (--restant === 0) this.selection.set(new Set());
      });
    });
  }

  private remplacer(maj: SiteItem): void {
    this.items.update((l) => l.map((i) => (i.id === maj.id ? maj : i)));
  }

  publier(): void {
    this.publication.set('Publication…');
    this.api.publier().subscribe((r) => {
      this.publication.set(r ? `Site mis à jour : ${r.produits} produits, ${r.projets} projets.` : 'La publication a échoué (R2 non configuré ?).');
      setTimeout(() => this.publication.set(''), 6000);
    });
  }

  ouvrir(i: SiteItem): void {
    this.router.navigate(['/dashboard', 'site', i.id]);
  }

  ouvrirCreation(): void {
    this.router.navigate(['/dashboard', 'site', 'nouveau'], { queryParams: { type: this.vue() } });
  }

  // ---------- Réorganiser par glisser-déposer ----------

  readonly glisse = signal<string | null>(null);
  readonly cible = signal<string | null>(null);

  /** On ne déplace une fiche qu'à l'intérieur de son groupe : les produits entre eux, ou les modèles d'une même collection. */
  private memeGroupe(a: SiteItem, b: SiteItem): boolean {
    return a.type === b.type && (a.parent_id ?? null) === (b.parent_id ?? null);
  }

  debutGlisser(i: SiteItem, event: DragEvent): void {
    this.glisse.set(i.id);
    event.dataTransfer?.setData('text/plain', i.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  survolGlisser(i: SiteItem, event: DragEvent): void {
    const source = this.items().find((x) => x.id === this.glisse());
    if (!source || source.id === i.id || !this.memeGroupe(source, i)) return;
    event.preventDefault();
    this.cible.set(i.id);
  }

  finGlisser(): void {
    this.glisse.set(null);
    this.cible.set(null);
  }

  deposer(i: SiteItem, event: DragEvent): void {
    event.preventDefault();
    const source = this.items().find((x) => x.id === this.glisse());
    this.finGlisser();
    if (!source || source.id === i.id || !this.memeGroupe(source, i)) return;
    const groupe = this.items()
      .filter((x) => this.memeGroupe(source, x))
      .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom));
    const ids = groupe.map((x) => x.id);
    const depuis = ids.indexOf(source.id);
    const vers = ids.indexOf(i.id);
    ids.splice(depuis, 1);
    ids.splice(vers, 0, source.id);
    // Affichage immédiat, puis enregistrement (le serveur numérote dans cet ordre).
    const rang = new Map(ids.map((id, n) => [id, n + 1]));
    this.items.update((l) => l.map((x) => (rang.has(x.id) ? { ...x, ordre: rang.get(x.id)! } : x)));
    this.api.ordre(ids).subscribe((ok) => {
      if (!ok) {
        this.erreur.set("L'ordre n'a pas pu être enregistré.");
        this.charger();
      }
    });
  }
}
