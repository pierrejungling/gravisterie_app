export type DureeValidite =
  | '1M'
  | '2M'
  | '3M'
  | '6M'
  | '1Y'
  | 'LIFE';

/** Interface alignée sur la réponse API / entité backend */
export interface Bon {
  id_bon: string;
  numero: string;
  intitule: string;
  date_creation: string;
  nom?: string | null;
  prenom?: string | null;
  duree_validite?: DureeValidite | null;
  date_echeance?: string | null;
  utilise: boolean;
  date_utilisation?: string | null;
  valeur?: number | null;
}
