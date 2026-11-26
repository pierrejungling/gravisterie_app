import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../environment/environment';
import { BONS, CLIENTS, COMMANDES, EVENEMENTS, FRAIS, SITE_ITEMS, uid } from './demo-data';

// Faux serveur : tout vit en mémoire dans le navigateur du visiteur et disparaît au rechargement.
const commandes: any[] = structuredClone(COMMANDES);
const clients: any[] = structuredClone(CLIENTS);
const evenements: any[] = structuredClone(EVENEMENTS);
const bons: any[] = structuredClone(BONS);
const frais: any[] = structuredClone(FRAIS);
const siteItems: any[] = structuredClone(SITE_ITEMS);
const cle = (o: any, k: string) => o?.[k];

const ok = (data: any = null) => ({ result: true, code: 'OK', data });
const ko = () => ({ result: false, code: 'DEMO', data: null });

function statsClient(c: any) {
  const mes = commandes.filter((m) => m.client?.id_client === c.id_client);
  const actives = mes.filter((m) => !['termine', 'annulee'].includes(m.statut_commande));
  const finies = mes.filter((m) => m.statut_commande === 'termine');
  const valides = mes.filter((m) => m.statut_commande !== 'annulee');
  const ca = valides.reduce((s, m) => s + Number(m.prix_final || 0), 0);
  const dates = mes.map((m) => m.date_commande).sort();
  return {
    nb_commandes: mes.length, nb_en_cours: actives.length, nb_terminees: finies.length,
    nb_annulees: mes.length - valides.length, ca_total: Math.round(ca),
    panier_moyen: valides.length ? Math.round(ca / valides.length) : 0,
    reste_a_payer: Math.round(valides.filter((m) => !m['payé']).reduce((s, m) => s + Number(m.prix_final || 0), 0)),
    premiere_commande: dates[0] ?? null, derniere_commande: dates[dates.length - 1] ?? null,
  };
}

function majPrix(c: any) {
  if (Array.isArray(c.lignes_prix)) {
    const total = c.lignes_prix.reduce((s: number, l: any) => s + Number(l.prix_final ?? (l.quantite * l.prix_unitaire) ?? 0), 0);
    c.prix_final = String(total);
    const q = c.lignes_prix.reduce((s: number, l: any) => s + Number(l.quantite || 0), 0);
    if (q) { c['quantité'] = q; c.prix_unitaire_final = String(total / q); }
  }
}

function handle(method: string, path: string, query: URLSearchParams, body: any): any {
  const p = path.split('/').filter(Boolean);
  const [a, b, c] = p;

  if (a === 'account') {
    if (b === 'me') return ok({ credential_id: 'demo', username: 'Démo', mail: 'demo@exemple.be', isAdmin: true, active: true, created: new Date().toISOString(), updated: new Date().toISOString() });
    return ok({ token: 'demo-token', refreshToken: 'demo-refresh' });
  }
  if (a === 'health') return ok({ status: 'ok', timestamp: new Date().toISOString(), uptime: 1, database: 'demo', environment: 'demo' });

  if (a === 'commande') {
    if (b === 'liste') return ok(commandes);
    if (b === 'recherche') {
      const q = (query.get('q') || query.get('terme') || '').toLowerCase();
      return ok(commandes.filter((m) => JSON.stringify([m.produit, m.client]).toLowerCase().includes(q)));
    }
    if (b === 'statut' && method === 'PUT') {
      const m = commandes.find((x) => x.id_commande === body?.id_commande);
      if (m) m.statut_commande = body.statut;
      return ok(m);
    }
    if (b === 'ajouter' && method === 'POST') {
      const id = 'CMD-' + uid();
      const cl = clients.find((x) => x.id_client === body?.id_client) ?? clients[0];
      const m: any = { ...structuredClone(COMMANDES[0]), id_commande: id, date_commande: new Date().toISOString(), statut_commande: 'en_attente_information', produit: body?.produit || 'Nouvelle commande', client: cl, ...(body || {}) };
      m.id_commande = id;
      commandes.unshift(m);
      return ok(m);
    }
    const m = commandes.find((x) => x.id_commande === b);
    if (c === 'fichiers') return ok([]);
    if (c === 'dupliquer' && m) { const d = { ...structuredClone(m), id_commande: 'CMD-' + uid() }; commandes.unshift(d); return ok(d); }
    if (!m) return ko();
    if (method === 'GET') return ok(m);
    if (method === 'DELETE') { commandes.splice(commandes.indexOf(m), 1); return ok(); }
    if (method === 'PUT') {
      Object.assign(m, body || {});
      if (body?.id_client) m.client = clients.find((x) => x.id_client === body.id_client) ?? m.client;
      majPrix(m);
      return ok(m);
    }
  }

  if (a === 'bon') {
    if (b === 'liste') return ok(bons);
    if (b === 'prochain-numero') return ok({ numero: `2026-${String(bons.length + 1).padStart(3, '0')}` });
    if (b === 'ajouter') { const n = { id_bon: 'BON-' + uid(), date_creation: new Date().toISOString(), utilise: false, date_utilisation: null, ...(body || {}) }; bons.unshift(n); return ok(n); }
    const x = bons.find((y) => y.id_bon === b);
    if (!x) return ko();
    if (c === 'utilise') { x.utilise = true; x.date_utilisation = new Date().toISOString(); return ok(x); }
    if (method === 'DELETE') { bons.splice(bons.indexOf(x), 1); return ok(); }
    if (method === 'PUT') { Object.assign(x, body || {}); return ok(x); }
    return ok(x);
  }

  if (a === 'frais-commission') {
    if (b === 'ajouter') { const n = { id_frais_commission: 'FC-' + uid(), ...(body || {}) }; frais.push(n); return ok(n); }
    return ok(frais);
  }

  if (a === 'client') {
    if (b === 'liste') return ok(clients.map((x) => ({ ...x, stats: statsClient(x) })));
    if (b === 'recherche') { const q = (query.get('q') || '').toLowerCase(); return ok(clients.filter((x) => JSON.stringify(x).toLowerCase().includes(q))); }
    if (b === 'correspondances' || b === 'doublons') return ok([]);
    if (b === 'fusionner') return ok();
    if (b === 'ajouter') { const n = { id_client: 'CL-' + uid(), adresse: null, tva: null, notes: null, ...(body || {}) }; clients.push(n); return ok(n); }
    const x = clients.find((y) => y.id_client === b);
    if (!x) return ko();
    if (method === 'PUT') { Object.assign(x, body || {}); return ok(x); }
    if (method === 'DELETE') { clients.splice(clients.indexOf(x), 1); return ok(); }
    return ok({ ...x, stats: statsClient(x), commandes: commandes.filter((m) => m.client?.id_client === x.id_client) });
  }

  if (a === 'evenement') {
    if (b === 'liste') return ok(evenements);
    if (!b && method === 'POST') { const n = { id_evenement: 'EV-' + uid(), materiel: [], stats: {}, ...(body || {}) }; evenements.push(n); return ok(n); }
    const x = evenements.find((y) => y.id_evenement === b);
    if (!x) return ko();
    if (method === 'PUT') { Object.assign(x, body || {}); return ok(x); }
    if (method === 'DELETE') { evenements.splice(evenements.indexOf(x), 1); return ok(); }
    return ok({ ...x, commandes: commandes.filter((m) => m.id_evenement === x.id_evenement).map((m) => ({ id_commande: m.id_commande, produit: m.produit, date_commande: m.date_commande, deadline: m.deadline, statut_commande: m.statut_commande, prix_final: Number(m.prix_final), 'payé': m['payé'], 'quantité': m['quantité'], client: m.client?.nom })) });
  }

  if (a === 'reseaux') return ok({ comptes: [{ nom: 'La Gravisterie', facebook: 2238, instagram: 404 }], mis_a_jour: new Date().toISOString() });
  if (a === 'site') {
    if (b === 'statut') return ok({ etat: 'ok', derniere: new Date().toISOString(), erreur: null, configure: false });
    if (b === 'resume') return ok({ produits: siteItems.filter((x) => x.type === 'produit').length, projets: siteItems.filter((x) => x.type === 'projet').length, masques: siteItems.filter((x) => !x.visible).length, sansPhoto: 0 });
    if (b === 'items') {
      if (c && c !== 'ordre') { const x = siteItems.find((y) => y.id === c); if (!x) return ko(); if (method === 'PUT') { Object.assign(x, body || {}); return ok(x); } return ok({ ...x, enfants: [], parent: null }); }
      const type = query.get('type');
      return ok(siteItems.filter((x) => !type || x.type === type));
    }
    if (b === 'publier') return ok({ produits: siteItems.length, projets: 0, urlProduits: '#', urlProjets: '#' });
    return ok([]);
  }
  return ok(null);
}

export const DemoBackendInterceptor: HttpInterceptorFn = (req, next) => {
  const base = environment.apiURL;
  if (!req.url.startsWith(base)) return next(req);
  const rest = req.url.slice(base.length);
  const [path, qs] = rest.split('?');
  const out = handle(req.method, path, new URLSearchParams(qs || ''), req.body);
  if (req.responseType === 'blob') {
    return of(new HttpResponse({ status: 200, body: new Blob(['Fichier de démonstration'], { type: 'text/plain' }) as any })).pipe(delay(80));
  }
  return of(new HttpResponse({ status: 200, body: out })).pipe(delay(120));
};
void cle;
