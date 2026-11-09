import { StatutCommande } from '../../commande/model/commande.interface';
export { euros, dateCourte, toneStatut, STATUT_LABELS } from '../../client/model/client.interface';

export type TypeEvenement = 'gravure_direct' | 'nocturne' | 'salon' | 'marche' | 'atelier' | 'autre';
export type StatutEvenement = 'prospect' | 'propose' | 'confirme' | 'termine' | 'annule' | 'refuse';
export type FormuleEvenement = 'a_definir' | 'illimite' | 'a_la_gravure' | 'stand';

export interface ElementMateriel {
  texte: string;
  fait: boolean;
}

export interface StatsEvenement {
  nb_commandes: number;
  ca_commandes: number;
  prestation: number;
  total: number;
}

export interface ClientEvenement {
  id_client: string;
  nom: string | null;
  prénom: string | null;
  société: string | null;
}

export interface Evenement {
  id_evenement: string;
  nom: string;
  type: TypeEvenement;
  statut: StatutEvenement;
  date_debut: string | null;
  date_fin: string | null;
  heure_arrivee: string | null;
  lieu: string | null;
  adresse: string | null;
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_mail: string | null;
  id_client: string | null;
  formule: FormuleEvenement;
  prix_forfait: number | string | null;
  prix_gravure: number | string | null;
  nb_gravures: number | null;
  heures_sur_place: number | string | null;
  heures_trajet: number | string | null;
  forfait_carburant: number | string | null;
  paye: boolean;
  materiel: ElementMateriel[];
  notes: string | null;
  date_creation: string;
  stats: StatsEvenement;
  client: ClientEvenement | null;
}

export interface CommandeEvenement {
  id_commande: string;
  produit: string | null;
  date_commande: string | null;
  deadline: string | null;
  statut_commande: StatutCommande;
  prix_final: number | null;
  payé: boolean;
  quantité: number | null;
  client: string | null;
}

export interface EvenementDetail extends Evenement {
  commandes: CommandeEvenement[];
}

export interface ResumeEvenement {
  id_evenement: string;
  nom: string;
  date_debut: string | null;
  statut: StatutEvenement;
}

export type EvenementPayload = Partial<
  Omit<Evenement, 'id_evenement' | 'stats' | 'client' | 'date_creation' | 'prix_forfait' | 'prix_gravure' | 'heures_sur_place' | 'heures_trajet' | 'forfait_carburant'>
> & {
  prix_forfait?: number | null;
  prix_gravure?: number | null;
  heures_sur_place?: number | null;
  heures_trajet?: number | null;
  forfait_carburant?: number | null;
};

export const TYPES_EVENEMENT: { valeur: TypeEvenement; label: string; icone: string }[] = [
  { valeur: 'gravure_direct', label: 'Gravure en direct', icone: '🕯️' },
  { valeur: 'nocturne', label: 'Nocturne', icone: '🌙' },
  { valeur: 'salon', label: 'Salon', icone: '🏛️' },
  { valeur: 'marche', label: 'Marché', icone: '🧺' },
  { valeur: 'atelier', label: 'Atelier', icone: '🛠️' },
  { valeur: 'autre', label: 'Autre', icone: '📍' },
];

export const STATUTS_EVENEMENT: { valeur: StatutEvenement; label: string; ton: 'accent' | 'ok' | 'warn' | 'bad' | '' }[] = [
  { valeur: 'prospect', label: 'Piste', ton: '' },
  { valeur: 'propose', label: 'Proposé', ton: 'warn' },
  { valeur: 'confirme', label: 'Confirmé', ton: 'accent' },
  { valeur: 'termine', label: 'Terminé', ton: 'ok' },
  { valeur: 'annule', label: 'Annulé', ton: 'bad' },
  { valeur: 'refuse', label: 'Refusé', ton: 'bad' },
];

export const FORMULES_EVENEMENT: { valeur: FormuleEvenement; label: string }[] = [
  { valeur: 'a_definir', label: 'À définir' },
  { valeur: 'illimite', label: 'Gravures illimitées (forfait)' },
  { valeur: 'a_la_gravure', label: 'À la gravure (fixe + prix par gravure)' },
  { valeur: 'stand', label: 'Stand (ventes uniquement)' },
];

/** Tarifs de la gravure en direct (Baobab) : base du calcul proposé. */
export const TARIFS_DIRECT = {
  heureAlaGravure: 40,
  prixGravure: 10,
  heureIllimite: 80,
};

export function typeEvenement(type: TypeEvenement) {
  return TYPES_EVENEMENT.find((t) => t.valeur === type) ?? TYPES_EVENEMENT[TYPES_EVENEMENT.length - 1];
}

export function statutEvenement(statut: StatutEvenement) {
  return STATUTS_EVENEMENT.find((s) => s.valeur === statut) ?? STATUTS_EVENEMENT[0];
}

export function nombre(valeur: number | string | null | undefined): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return isFinite(n) ? n : null;
}

/** Suggestions de prix à partir des heures (sur place + trajet) et du carburant. */
export function calculFormules(e: Pick<Evenement, 'heures_sur_place' | 'heures_trajet' | 'forfait_carburant'>) {
  const heures = (nombre(e.heures_sur_place) ?? 0) + (nombre(e.heures_trajet) ?? 0);
  if (heures <= 0) return null;
  const carburant = nombre(e.forfait_carburant) ?? 0;
  return {
    heures,
    alaGravure: Math.round(heures * TARIFS_DIRECT.heureAlaGravure + carburant),
    illimite: Math.round(heures * TARIFS_DIRECT.heureIllimite + carburant),
  };
}

/** « jeu. 12 nov. 2026 » */
export function dateLongue(valeur: string | null | undefined): string {
  if (!valeur) return 'Date à fixer';
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? 'Date à fixer' : d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** « 17 h 00 » */
export function heure(valeur: string | null | undefined): string {
  if (!valeur) return '';
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return '';
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

export function horaire(e: Pick<Evenement, 'date_debut' | 'date_fin'>): string {
  const debut = heure(e.date_debut);
  const fin = heure(e.date_fin);
  if (!debut) return '';
  const memeJour = e.date_fin && e.date_debut && new Date(e.date_fin).toDateString() === new Date(e.date_debut).toDateString();
  if (fin && memeJour) return `${debut} à ${fin}`;
  if (fin) return `${debut} → ${dateLongue(e.date_fin)} ${fin}`;
  return debut;
}

/** Valeur pour un champ <input type="datetime-local"> (heure locale). */
export function versChampDate(valeur: string | null | undefined): string {
  if (!valeur) return '';
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function depuisChampDate(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function aVenir(e: Pick<Evenement, 'date_debut' | 'date_fin' | 'statut'>): boolean {
  if (e.statut === 'termine' || e.statut === 'annule' || e.statut === 'refuse') return false;
  const ref = e.date_fin || e.date_debut;
  if (!ref) return true;
  const fin = new Date(ref);
  fin.setHours(23, 59, 59, 999);
  return fin.getTime() >= Date.now();
}

/** Nombre de jours avant l'événement (0 = aujourd'hui), null si pas de date. */
export function joursAvant(valeur: string | null | undefined): number | null {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return null;
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - a.getTime()) / 86400000);
}

export function nomClientEvenement(c: ClientEvenement | null): string {
  if (!c) return '';
  return [c.prénom, c.nom].filter((v) => v && String(v).trim()).join(' ') || c.société || '';
}
