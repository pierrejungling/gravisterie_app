import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, ApiURI, EVENEMENT_BY_ID } from '@api';
import { Evenement, EvenementDetail, EvenementPayload, ResumeEvenement } from '../model/evenement.interface';

@Injectable({ providedIn: 'root' })
export class EvenementApiService {
  private readonly api = inject(ApiService);

  liste(): Observable<Evenement[] | null> {
    return this.api.get(ApiURI.LISTE_EVENEMENTS).pipe(map((r) => (r.result && r.data ? (r.data as Evenement[]) : null)));
  }

  detail(id: string): Observable<EvenementDetail | null> {
    return this.api.get(EVENEMENT_BY_ID(id)).pipe(map((r) => (r.result && r.data ? (r.data as EvenementDetail) : null)));
  }

  resume(id: string): Observable<ResumeEvenement | null> {
    return this.api.get(`${EVENEMENT_BY_ID(id)}/resume`).pipe(map((r) => (r.result && r.data ? (r.data as ResumeEvenement) : null)));
  }

  creer(payload: EvenementPayload): Observable<Evenement | null> {
    return this.api.post(ApiURI.EVENEMENT, payload as any).pipe(map((r) => (r.result && r.data ? (r.data as Evenement) : null)));
  }

  modifier(id: string, payload: EvenementPayload): Observable<Evenement | null> {
    return this.api.put(EVENEMENT_BY_ID(id), payload as any).pipe(map((r) => (r.result && r.data ? (r.data as Evenement) : null)));
  }

  supprimer(id: string): Observable<boolean> {
    return this.api.delete(EVENEMENT_BY_ID(id)).pipe(map((r) => !!r.result));
  }

  lierCommande(id: string, idCommande: string): Observable<boolean> {
    return this.api.post(`${EVENEMENT_BY_ID(id)}/commandes`, { id_commande: idCommande } as any).pipe(map((r) => !!r.result));
  }

  delierCommande(id: string, idCommande: string): Observable<boolean> {
    return this.api.delete(`${EVENEMENT_BY_ID(id)}/commandes/${idCommande}`).pipe(map((r) => !!r.result));
  }
}
