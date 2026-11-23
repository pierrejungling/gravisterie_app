import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, ApiService } from '@api';
import { SiteItem, SiteItemPayload, SitePublication, SiteType } from '../model/site.interface';

@Injectable({ providedIn: 'root' })
export class SiteApiService {
  private readonly api = inject(ApiService);

  liste(type?: SiteType): Observable<SiteItem[] | null> {
    return this.api.get(`site/items${type ? `?type=${type}` : ''}`).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem[]) : null)));
  }

  /** Réponse brute, pour afficher le message du serveur (ex. identifiant déjà pris). */
  creerBrut(payload: SiteItemPayload): Observable<ApiResponse> {
    return this.api.post('site/items', payload as any);
  }

  obtenir(id: string): Observable<SiteItem | null> {
    return this.api.get(`site/items/${id}`).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem) : null)));
  }

  creer(payload: SiteItemPayload): Observable<SiteItem | null> {
    return this.api.post('site/items', payload as any).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem) : null)));
  }

  modifier(id: string, payload: SiteItemPayload): Observable<SiteItem | null> {
    return this.api.put(`site/items/${id}`, payload as any).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem) : null)));
  }

  /** Réponse brute, pour distinguer un conflit (fiche modifiée ailleurs) d'une autre erreur. */
  modifierBrut(id: string, payload: SiteItemPayload): Observable<ApiResponse> {
    return this.api.put(`site/items/${id}`, payload as any);
  }

  /** Enregistre l'ordre d'affichage d'un groupe de fiches (ids dans le nouvel ordre). */
  ordre(ids: string[]): Observable<boolean> {
    return this.api.put('site/items/ordre', { ids } as any).pipe(map((r) => !!r.result));
  }

  supprimer(id: string): Observable<boolean> {
    return this.api.delete(`site/items/${id}`).pipe(map((r) => !!r.result));
  }

  ajouterImages(id: string, fichiers: File[]): Observable<SiteItem | null> {
    const fd = new FormData();
    fichiers.forEach((f) => fd.append('files', f, f.name));
    return this.api.postFormData(`site/items/${id}/images`, fd).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem) : null)));
  }

  definirImages(id: string, images: string[]): Observable<SiteItem | null> {
    return this.api.put(`site/items/${id}/images`, { images } as any).pipe(map((r) => (r.result && r.data ? (r.data as SiteItem) : null)));
  }

  publier(): Observable<SitePublication | null> {
    return this.api.post('site/publier', {} as any).pipe(map((r) => (r.result && r.data ? (r.data as SitePublication) : null)));
  }
}
