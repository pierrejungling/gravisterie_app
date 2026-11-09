import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService, ApiURI, CLIENT_BY_ID } from '@api';
import { ClientPayload, FicheClient, FicheClientDetail } from '../model/client.interface';

@Injectable({ providedIn: 'root' })
export class ClientApiService {
  private readonly api = inject(ApiService);

  liste(): Observable<FicheClient[]> {
    return this.api.get(ApiURI.LISTE_CLIENTS).pipe(map((r) => (r.result && r.data ? (r.data as FicheClient[]) : [])));
  }

  recherche(q: string, limit = 8): Observable<FicheClient[]> {
    return this.api
      .getWithQuery(ApiURI.RECHERCHE_CLIENTS, { q, limit })
      .pipe(map((r) => (r.result && r.data ? (r.data as FicheClient[]) : [])));
  }

  doublons(): Observable<FicheClient[][]> {
    return this.api.get(ApiURI.DOUBLONS_CLIENTS).pipe(map((r) => (r.result && r.data ? (r.data as FicheClient[][]) : [])));
  }

  detail(idClient: string): Observable<FicheClientDetail | null> {
    return this.api.get(CLIENT_BY_ID(idClient)).pipe(map((r) => (r.result && r.data ? (r.data as FicheClientDetail) : null)));
  }

  ajouter(payload: ClientPayload): Observable<FicheClient | null> {
    return this.api.post(ApiURI.AJOUTER_CLIENT, payload as any).pipe(map((r) => (r.result ? (r.data as FicheClient) : null)));
  }

  modifier(idClient: string, payload: ClientPayload): Observable<FicheClient | null> {
    return this.api.put(CLIENT_BY_ID(idClient), payload as any).pipe(map((r) => (r.result ? (r.data as FicheClient) : null)));
  }

  supprimer(idClient: string): Observable<boolean> {
    return this.api.delete(CLIENT_BY_ID(idClient)).pipe(map((r) => !!r.result));
  }

  fusionner(idCible: string, idsSources: string[]): Observable<FicheClientDetail | null> {
    return this.api
      .post(ApiURI.FUSIONNER_CLIENTS, { id_client_cible: idCible, ids_clients_sources: idsSources } as any)
      .pipe(map((r) => (r.result ? (r.data as FicheClientDetail) : null)));
  }
}
