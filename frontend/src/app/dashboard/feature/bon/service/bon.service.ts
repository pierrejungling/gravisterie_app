import { Injectable, inject, signal, WritableSignal, computed } from '@angular/core';
import { ApiService } from '@api';
import { ApiURI, BON_UPDATE, BON_DELETE } from '@api';
import { Bon, DureeValidite } from '../model/bon.interface';

@Injectable({
  providedIn: 'root',
})
export class BonService {
  private readonly apiService: ApiService = inject(ApiService);
  private readonly bonsSignal: WritableSignal<Bon[]> = signal<Bon[]>([]);

  readonly bons = computed(() => this.bonsSignal());

  loadBons(): void {
    this.apiService.get(ApiURI.LISTE_BONS).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.bonsSignal.set(response.data as Bon[]);
        }
      },
      error: (err) => console.error('Erreur chargement bons:', err),
    });
  }

  getBons(): Bon[] {
    return this.bonsSignal();
  }

  getNextNumero(callback: (numero: string) => void): void {
    this.apiService.get(ApiURI.PROCHAIN_NUMERO_BON).subscribe({
      next: (response) => {
        if (response.result && response.data?.numero) {
          callback(response.data.numero);
        } else {
          callback('0001');
        }
      },
      error: () => callback('0001'),
    });
  }

  addBon(payload: Omit<Bon, 'id_bon'>, onSuccess?: () => void, onError?: (err: unknown) => void): void {
    const body = {
      numero: payload.numero,
      intitule: payload.intitule,
      date_creation: payload.date_creation,
      nom: payload.nom ?? null,
      prenom: payload.prenom ?? null,
      duree_validite: payload.duree_validite ?? null,
      date_echeance: payload.date_echeance ?? null,
      valeur: payload.valeur ?? null,
    };
    this.apiService.post(ApiURI.AJOUTER_BON, body).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.bonsSignal.update((list) => [response.data as Bon, ...list]);
          onSuccess?.();
        } else {
          onError?.(response);
        }
      },
      error: (err) => {
        console.error('Erreur création bon:', err);
        onError?.(err);
      },
    });
  }

  setUtilise(idBon: string, utilise: boolean, onSuccess?: () => void, onError?: (err: unknown) => void): void {
    if (utilise) {
      const dateUtilisation = new Date().toISOString().split('T')[0];
      this.apiService.put(BON_UPDATE(idBon), { utilise: true, date_utilisation: dateUtilisation }).subscribe({
        next: (response) => {
          if (response.result && response.data) {
            const updated = response.data as Bon;
            this.bonsSignal.update((list) =>
              list.map((b) => (b.id_bon === idBon ? updated : b)),
            );
            onSuccess?.();
          } else {
            onError?.(response);
          }
        },
        error: (err) => {
          console.error('Erreur marquage bon utilisé:', err);
          onError?.(err);
        },
      });
    } else {
      this.apiService.put(BON_UPDATE(idBon), { utilise: false }).subscribe({
        next: (response) => {
          if (response.result && response.data) {
            const updated = response.data as Bon;
            this.bonsSignal.update((list) =>
              list.map((b) => (b.id_bon === idBon ? updated : b)),
            );
            onSuccess?.();
          } else {
            onError?.(response);
          }
        },
        error: (err) => {
          console.error('Erreur décocher bon:', err);
          onError?.(err);
        },
      });
    }
  }

  updateBon(bon: Partial<Bon> & { id_bon: string }, onSuccess?: () => void, onError?: (err: unknown) => void): void {
    const { id_bon, ...body } = bon;
    this.apiService.put(BON_UPDATE(id_bon), body).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          const updated = response.data as Bon;
          this.bonsSignal.update((list) =>
            list.map((b) => (b.id_bon === id_bon ? updated : b)),
          );
          onSuccess?.();
        } else {
          onError?.(response);
        }
      },
      error: (err) => {
        console.error('Erreur mise à jour bon:', err);
        onError?.(err);
      },
    });
  }

  deleteBon(idBon: string, onSuccess?: () => void, onError?: (err: unknown) => void): void {
    this.apiService.delete(BON_DELETE(idBon)).subscribe({
      next: (response) => {
        if (response.result !== false) {
          this.bonsSignal.update((list) => list.filter((b) => b.id_bon !== idBon));
          onSuccess?.();
        } else {
          onError?.(response);
        }
      },
      error: (err) => {
        console.error('Erreur suppression bon:', err);
        onError?.(err);
      },
    });
  }

  /** Indique si un bon actif est expiré (date d'échéance dépassée). */
  static isExpired(bon: Bon): boolean {
    if (bon.duree_validite === 'LIFE') return false;
    const de = bon.date_echeance;
    if (!de) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dEcheance = new Date(de);
    dEcheance.setHours(0, 0, 0, 0);
    return dEcheance < today;
  }

  static computeDateEcheance(
    dateCreation: string,
    duree: DureeValidite | null | undefined,
    dateManuelle?: string | null,
  ): string | null {
    if (duree === 'LIFE') return null;
    if (!duree && dateManuelle) return dateManuelle;
    if (!duree) return null;
    const base = new Date(dateCreation || new Date().toISOString().split('T')[0]);
    const result = new Date(base.getTime());
    const addMonths = (months: number) => {
      const d = new Date(result.getTime());
      d.setMonth(d.getMonth() + months);
      return d;
    };
    switch (duree) {
      case '1M': result.setTime(addMonths(1).getTime()); break;
      case '2M': result.setTime(addMonths(2).getTime()); break;
      case '3M': result.setTime(addMonths(3).getTime()); break;
      case '6M': result.setTime(addMonths(6).getTime()); break;
      case '1Y': result.setTime(addMonths(12).getTime()); break;
    }
    return result.toISOString().split('T')[0];
  }
}
