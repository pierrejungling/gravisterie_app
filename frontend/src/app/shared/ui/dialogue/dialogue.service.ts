import { Injectable, signal } from '@angular/core';

export interface DialogueOptions {
  titre: string;
  message?: string;
  /** Petit libellé au-dessus du titre (défaut : « Confirmation »). */
  eyebrow?: string;
  /** Texte du bouton de validation (défaut : « Confirmer »). */
  confirmer?: string;
  annuler?: string;
  /** Bouton rouge pour une action destructive (suppression). */
  danger?: boolean;
  /** Pour `saisir` : libellé et valeur initiale du champ. */
  champ?: { label: string; placeholder?: string; valeur?: string };
}

export interface DialogueEtat extends DialogueOptions {
  resoudre: (valeur: boolean | string | null) => void;
}

/**
 * Boîtes de dialogue dans la DA de l'app, à la place des fenêtres natives du navigateur (confirm, prompt).
 * Le composant `gv-dialogue`, placé une seule fois dans l'application, les affiche.
 */
@Injectable({ providedIn: 'root' })
export class DialogueService {
  readonly courant = signal<DialogueEtat | null>(null);

  /** Demande une confirmation. Renvoie true si l'utilisateur confirme. */
  confirmer(options: DialogueOptions): Promise<boolean> {
    return new Promise((ok) => this.ouvrir({ ...options, resoudre: (v) => ok(v === true) }));
  }

  /** Demande un texte. Renvoie le texte saisi, ou null si l'utilisateur annule. */
  saisir(options: DialogueOptions): Promise<string | null> {
    return new Promise((ok) => this.ouvrir({ ...options, champ: options.champ ?? { label: '' }, resoudre: (v) => ok(typeof v === 'string' ? v : null) }));
  }

  private ouvrir(etat: DialogueEtat): void {
    // Une boîte déjà ouverte est annulée avant d'en montrer une autre.
    this.courant()?.resoudre(null);
    this.courant.set(etat);
  }

  fermer(valeur: boolean | string | null): void {
    const e = this.courant();
    if (!e) return;
    this.courant.set(null);
    e.resoudre(valeur);
  }
}
