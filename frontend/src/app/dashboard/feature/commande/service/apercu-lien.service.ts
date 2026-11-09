import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, ApiURI } from '@api';

export interface ApercuLien {
  url: string;
  image: string | null;
  titre: string | null;
  site: string | null;
  manuel: boolean;
}

/** null = pas encore chargé ; 'erreur' = le serveur n'a pas répondu. */
export type EtatApercu = ApercuLien | 'chargement' | 'erreur' | null;

/**
 * Aperçus des liens de frais, partagés entre tous les affichages d'un même lien
 * (carte du frais, tableau « Détails des frais »).
 */
@Injectable({ providedIn: 'root' })
export class ApercuLienService {
  private readonly api = inject(ApiService);
  private readonly etats = new Map<string, BehaviorSubject<EtatApercu>>();

  /** Lien utilisable, ou null si le texte n'en est pas un. */
  normaliser(brut: string | null | undefined): string | null {
    let texte = (brut || '').trim();
    if (!texte || /\s/.test(texte)) return null;
    if (!/^https?:\/\//i.test(texte)) {
      if (!/^[\w-]+(\.[\w-]+)+(\/|$)/.test(texte)) return null;
      texte = `https://${texte}`;
    }
    try {
      const u = new URL(texte);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
      u.hash = '';
      return u.toString();
    } catch {
      return null;
    }
  }

  suivre(url: string): Observable<EtatApercu> {
    let etat = this.etats.get(url);
    if (!etat) {
      etat = new BehaviorSubject<EtatApercu>('chargement');
      this.etats.set(url, etat);
      this.charger(url, false);
    }
    return etat.asObservable();
  }

  recharger(url: string): void {
    this.sujet(url).next('chargement');
    this.charger(url, true);
  }

  /** Image choisie à la main (adresse ou image collée) ; null = revenir à l'automatique. */
  changerImage(url: string, image: string | null): Observable<boolean> {
    return this.api.put(ApiURI.APERCU_LIEN_IMAGE, { url, image } as any).pipe(
      map((r) => {
        if (!r.result || !r.data) return false;
        this.sujet(url).next(r.data as ApercuLien);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  private charger(url: string, forcer: boolean): void {
    const params: Record<string, string> = { url };
    if (forcer) params['forcer'] = '1';
    this.api.getWithQuery(ApiURI.APERCU_LIEN, params).subscribe({
      next: (r) => this.sujet(url).next(r.result && r.data ? (r.data as ApercuLien) : 'erreur'),
      error: () => this.sujet(url).next('erreur'),
    });
  }

  private sujet(url: string): BehaviorSubject<EtatApercu> {
    let etat = this.etats.get(url);
    if (!etat) {
      etat = new BehaviorSubject<EtatApercu>(null);
      this.etats.set(url, etat);
    }
    return etat;
  }
}
