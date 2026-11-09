import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ApiService, ApiURI, RealtimeService } from '@api';
import { Commande, StatutCommande, getCommandeSiteDisplayTitle } from '../model/commande.interface';

/** Une commande gardée ouverte dans la barre d'onglets. */
export interface OngletCommande {
  id: string;
  titre: string;
  client: string;
  statut: StatutCommande | null;
}

const CLE_STOCKAGE = 'gv-onglets-commandes';
const MAX_ONGLETS = 12;
const PREFIXE_DETAIL = '/dashboard/commandes/detail/';
const ROUTE_TABLEAU = '/dashboard/commandes/en-cours';

/**
 * Onglets des commandes ouvertes (façon navigateur) :
 * chaque commande consultée ouvre un onglet, gardé entre les visites (stockage local).
 * La position de lecture de chaque commande est retenue pendant la session
 * (même clé que celle relue par le détail commande à l'ouverture).
 */
@Injectable({ providedIn: 'root' })
export class CommandeOngletsService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);

  readonly onglets = signal<OngletCommande[]>(this.lire());
  /** URL courante (sans paramètres). */
  readonly url = signal<string>('');

  /** Id de la commande affichée, s'il y en a une. */
  readonly actif = computed(() => {
    const url = this.url();
    return url.startsWith(PREFIXE_DETAIL) ? url.slice(PREFIXE_DETAIL.length).split('/')[0] : null;
  });
  readonly surTableau = computed(() => this.url().startsWith(ROUTE_TABLEAU));
  /** La barre s'affiche sur le tableau et sur le détail d'une commande. */
  readonly visible = computed(() => (this.surTableau() && this.onglets().length > 0) || this.actif() !== null);

  private demarre = false;

  /** Appelé une fois par la coquille (header). */
  demarrer(): void {
    if (this.demarre) return;
    this.demarre = true;
    this.url.set(this.nettoyer(this.router.url));
    this.ouvrirDepuisUrl();

    this.router.events.pipe(filter((e) => e instanceof NavigationStart)).subscribe(() => {
      const actif = this.actif();
      if (actif) this.memoriserScroll(actif);
    });
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.url.set(this.nettoyer(e.urlAfterRedirects));
      this.ouvrirDepuisUrl();
    });

    this.realtime.on('commande').subscribe((event) => {
      if (!event.id) return;
      if (event.action === 'deleted') {
        this.retirer(event.id);
      } else if (this.onglets().some((o) => o.id === event.id) && event.id !== this.actif()) {
        this.chargerInfos(event.id);
      }
    });
  }

  /** Le détail d'une commande donne son titre, son client et son statut une fois chargée. */
  renseigner(commande: Commande): void {
    const infos = this.infos(commande);
    this.onglets.update((list) => {
      const existe = list.some((o) => o.id === infos.id);
      const suite = existe ? list.map((o) => (o.id === infos.id ? infos : o)) : [...list, infos];
      return this.limiter(suite);
    });
    this.ecrire();
  }

  fermer(id: string): void {
    const list = this.onglets();
    const index = list.findIndex((o) => o.id === id);
    if (index === -1) return;
    const suivants = list.filter((o) => o.id !== id);
    this.onglets.set(suivants);
    this.ecrire();
    this.oublierScroll(id);
    if (this.actif() === id) {
      const voisin = suivants[index] ?? suivants[index - 1];
      this.router.navigateByUrl(voisin ? PREFIXE_DETAIL + voisin.id : ROUTE_TABLEAU);
    }
  }

  fermerAutres(): void {
    const actif = this.actif();
    this.onglets.set(this.onglets().filter((o) => o.id === actif));
    this.ecrire();
  }

  fermerTout(): void {
    this.onglets.set([]);
    this.ecrire();
    if (this.actif()) this.router.navigateByUrl(ROUTE_TABLEAU);
  }

  aller(id: string): void {
    if (id !== this.actif()) this.router.navigateByUrl(PREFIXE_DETAIL + id);
  }

  allerTableau(): void {
    this.router.navigateByUrl(ROUTE_TABLEAU);
  }

  // ---------- interne ----------

  private ouvrirDepuisUrl(): void {
    const id = this.actif();
    if (!id) return;
    if (!this.onglets().some((o) => o.id === id)) {
      this.onglets.update((list) => this.limiter([...list, { id, titre: 'Commande…', client: '', statut: null }]));
      this.ecrire();
    }
  }

  /** Met à jour un onglet en arrière-plan (commande modifiée ailleurs). */
  private chargerInfos(id: string): void {
    this.api.get(`${ApiURI.GET_COMMANDE_BY_ID}/${id}`).subscribe({
      next: (r) => {
        if (!r.result || !r.data) return;
        const infos = this.infos(r.data as Commande);
        this.onglets.update((list) => list.map((o) => (o.id === id ? infos : o)));
        this.ecrire();
      },
      error: () => undefined,
    });
  }

  private retirer(id: string): void {
    if (!this.onglets().some((o) => o.id === id)) return;
    this.onglets.update((list) => list.filter((o) => o.id !== id));
    this.ecrire();
  }

  private infos(commande: Commande): OngletCommande {
    const c = commande.client;
    const client = c ? [c.prénom, c.nom].filter((v) => v && String(v).trim()).join(' ') || c.société || '' : '';
    return {
      id: commande.id_commande,
      titre: getCommandeSiteDisplayTitle(commande),
      client,
      statut: commande.statut_commande ?? null,
    };
  }

  /** Au-delà du maximum, on retire les plus anciens onglets (sauf celui affiché). */
  private limiter(list: OngletCommande[]): OngletCommande[] {
    const actif = this.actif();
    const copie = [...list];
    while (copie.length > MAX_ONGLETS) {
      const index = copie.findIndex((o) => o.id !== actif);
      if (index === -1) break;
      copie.splice(index, 1);
    }
    return copie;
  }

  private nettoyer(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  private lire(): OngletCommande[] {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      const list = brut ? (JSON.parse(brut) as OngletCommande[]) : [];
      return Array.isArray(list) ? list.filter((o) => o && typeof o.id === 'string').slice(-MAX_ONGLETS) : [];
    } catch {
      return [];
    }
  }

  private ecrire(): void {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(this.onglets()));
    } catch {}
  }

  private cleScroll(id: string): string {
    return `detail-commande-${id}-scroll`;
  }

  private memoriserScroll(id: string): void {
    try {
      sessionStorage.setItem(this.cleScroll(id), String(Math.round(window.scrollY)));
    } catch {}
  }

  private oublierScroll(id: string): void {
    try {
      sessionStorage.removeItem(this.cleScroll(id));
    } catch {}
  }
}
