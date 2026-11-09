import { StatutCommande } from '../../commande/model/commande.interface';
export { adresseUtile } from '../../commande/util/adresse.util';

/** Chiffres d'un client calculés par l'API (les commandes annulées sont exclues du CA). */
export interface StatsClient {
  nb_commandes: number;
  nb_en_cours: number;
  nb_terminees: number;
  nb_annulees: number;
  ca_total: number;
  panier_moyen: number;
  reste_a_payer: number;
  premiere_commande: string | null;
  derniere_commande: string | null;
}

export interface FicheClient {
  id_client: string;
  nom: string | null;
  prénom: string | null;
  société: string | null;
  mail: string | null;
  téléphone: string | null;
  adresse: string | null;
  tva: string | null;
  notes: string | null;
  stats: StatsClient;
}

export interface CommandeClientResume {
  id_commande: string;
  produit: string | null;
  date_commande: string | null;
  deadline: string | null;
  statut_commande: StatutCommande;
  statuts_actifs: StatutCommande[] | null;
  prix_final: number | null;
  payé: boolean;
  quantité: number | null;
}

export interface FicheClientDetail extends FicheClient {
  commandes: CommandeClientResume[];
}

/** Champs modifiables d'une fiche (noms sans accents, comme l'API). */
export interface ClientPayload {
  nom?: string;
  prenom?: string;
  societe?: string;
  mail?: string;
  telephone?: string;
  adresse?: string;
  tva?: string;
  notes?: string;
}

/** Nom affiché : « Prénom Nom », sinon la société, sinon le mail. */
export function nomClient(client: Partial<FicheClient> | null | undefined): string {
  if (!client) return 'Client inconnu';
  const personne = [client.prénom, client.nom].filter((v) => !!v && String(v).trim()).join(' ').trim();
  return personne || client.société || client.mail || client.téléphone || 'Sans nom';
}

/** Initiales pour l'avatar (2 lettres). */
export function initialesClient(client: Partial<FicheClient> | null | undefined): string {
  const nom = nomClient(client);
  const mots = nom.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '·';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

/** Libellés courts des statuts (mêmes mots que le Kanban). */
export const STATUT_LABELS: Record<StatutCommande, string> = {
  [StatutCommande.EN_ATTENTE_INFORMATION]: 'Attente',
  [StatutCommande.A_MODELLISER_PREPARER]: 'Modélisation',
  [StatutCommande.A_GRAVER]: 'Gravure',
  [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'Finition',
  [StatutCommande.A_PRENDRE_EN_PHOTO]: 'Photo',
  [StatutCommande.A_LIVRER]: 'Livraison',
  [StatutCommande.A_METTRE_EN_LIGNE]: 'WEB',
  [StatutCommande.A_FACTURER]: 'Facturation',
  [StatutCommande.DEMANDE_AVIS]: 'Avis',
  [StatutCommande.TERMINE]: 'Terminé',
  [StatutCommande.ANNULEE]: 'Annulée',
};

/** Ton du badge de statut. */
export function toneStatut(statut: StatutCommande): 'ok' | 'bad' | 'accent' {
  if (statut === StatutCommande.TERMINE) return 'ok';
  if (statut === StatutCommande.ANNULEE) return 'bad';
  return 'accent';
}

const FORMAT_EUROS = new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 });
const FORMAT_EUROS_CENTS = new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 1 234 € » (ou « 12,50 € » avec cents=true). */
export function euros(valeur: number | null | undefined, cents = false): string {
  if (valeur === null || valeur === undefined || isNaN(Number(valeur))) return '-';
  return (cents ? FORMAT_EUROS_CENTS : FORMAT_EUROS).format(Number(valeur)) + ' €';
}

/** « 09/11/2026 » */
export function dateCourte(valeur: string | null | undefined): string {
  if (!valeur) return '-';
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
