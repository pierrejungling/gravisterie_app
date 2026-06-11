/** Métadonnées d'un fichier joint à une commande (stocké en DB, fichier dans R2). */
export interface CommandeFichier {
  id_fichier: string;
  nom_fichier: string;
  type_mime: string | null;
  taille_octets: number | null;
  date_upload: string;
}

export interface CoordonneesContact {
  nom: string;
  prenom: string;
  telephone: string;
  mail: string;
  adresse?: string;
  societe?: string;
  tva?: string;
}

export interface AjouterCommandePayload {
  nom_commande: string;
  deadline: string;
  coordonnees_contact: CoordonneesContact;
  description_projet?: string;
  dimensions_souhaitees?: string;
  couleur?: string[];
  support?: string;
  police_ecriture?: string;
  texte_personnalisation?: string;
  fichiers_joints?: string[];
  quantité?: number;
  payé?: boolean;
  commentaire_paye?: string;
  attente_reponse?: boolean; // false = client attend réponse, true = moi qui attends réponse
  mode_contact?: string; // 'mail', 'tel', ou 'meta'
  statut_initial?: string;
}

export enum Couleur {
  NOIR = 'noir',
  NATUREL = 'naturel',
  LASURE = 'lasuré',
  OR = 'or',
  ARGENT = 'argent',
  BLANC = 'blanc',
  GRAVURE_PEINTE = 'gravure peinte'
}

export enum StatutCommande {
  EN_ATTENTE_INFORMATION = 'en_attente_information',
  A_MODELLISER_PREPARER = 'a_modeliser_preparer',
  A_GRAVER = 'a_graver',
  A_FINIR_LAVER_ASSEMBLER_PEINDRE = 'a_finir_laver_assembler_peindre',
  A_PRENDRE_EN_PHOTO = 'a_prendre_en_photo',
  A_LIVRER = 'a_livrer',
  A_METTRE_EN_LIGNE = 'a_mettre_en_ligne',
  A_FACTURER = 'a_facturer',
  DEMANDE_AVIS = 'demande_avis',
  TERMINE = 'termine',
  ANNULEE = 'annulee',
}

export enum ModeContact {
  MAIL = 'mail',
  TEL = 'tel',
  META = 'meta'
}

/** Un bloc « realise / objectif » étiquetable (ex. Socle × 50 unités). */
export interface QuantiteProduitCompteur {
  id: string;
  libelle: string;
  quantite_cible: number;
  quantite_realisee: number;
}

export interface Client {
  id_client: string;
  nom?: string;
  prénom?: string;
  société?: string;
  mail?: string | null;
  téléphone?: string | null;
  adresse?: string;
  tva?: string;
}

const SITE_ORDER_TITLE_PREFIX = /^(?:📫\s*)?(?:WEB|🌐)\s*(?:\|\s*)?/iu;

/** Commande issue du site vitrine (webhook), y compris les anciennes entrées sans `source_web`. */
export function isCommandeSite(commande: Pick<Commande, 'source_web' | 'produit'>): boolean {
  if (commande.source_web) {
    return true;
  }
  return SITE_ORDER_TITLE_PREFIX.test(commande.produit?.trimStart() ?? '');
}

/** Commande site encore à traiter (pastille active dans le kanban). */
export function isCommandeSiteNonTraitee(commande: Pick<Commande, 'source_web' | 'produit' | 'site_traitee'>): boolean {
  return isCommandeSite(commande) && !commande.site_traitee;
}

/** Normalise l'affichage du titre (🌐 …, sans ancien 📫, WEB ni barre |). */
export function formatProduitCommandeSite(produit: string | null | undefined): string {
  return (produit ?? '')
    .replace(/^📫\s*/u, '')
    .replace(/^WEB\s*\|\s*/i, '🌐 ')
    .replace(/^WEB\s+/i, '🌐 ')
    .replace(/^🌐\s*\|\s*/u, '🌐 ')
    .trim();
}

/** Titre affiché sans le préfixe technique « 🌐 ». */
export function getCommandeSiteDisplayTitle(commande: Pick<Commande, 'id_commande' | 'produit'>): string {
  const fallback = `Commande #${commande.id_commande.substring(0, 8)}`;
  const raw = commande.produit?.trim() || fallback;
  const stripped = raw.replace(SITE_ORDER_TITLE_PREFIX, '').trim();
  return stripped || raw;
}

export interface Commande {
  id_commande: string;
  date_commande: string;
  deadline?: string;
  produit?: string;
  description?: string;
  fichiers_joints?: string;
  statut_commande: StatutCommande;
  statuts_actifs?: StatutCommande[];
  prix_final?: number;
  quantité?: number;
  quantite_realisee?: number;
  quantite_produit_compteurs?: QuantiteProduitCompteur[] | null;
  payé?: boolean;
  commentaire_paye?: string;
  attente_reponse?: boolean; // false = client attend réponse, true = moi qui attends réponse
  mode_contact?: string; // 'mail', 'tel', ou 'meta'
  source_web?: boolean;
  site_traitee?: boolean;
  client: Client;
  support?: {
    nom_support?: string;
    prix_support?: number;
    url_support?: string;
  };
  supports?: Array<{
    nom_support?: string;
    prix_support?: number;
    url_support?: string;
    prix_unitaire?: boolean; // true = prix unitaire, false = prix pour X unités
    nombre_unites?: number; // X unités si prix_unitaire = false
    prix_support_unitaire?: number; // Calculé automatiquement
    actif?: boolean; // true = inclus dans le tableau Détails des frais et dans les totaux
  }>;
  prix_unitaire_final?: number; // Prix unitaire final de vente
  frais_pourcentage?: number; // Frais/commission en % pour les ventes
  frais_commission_id?: string | null;
  frais_commission_libelle?: string | null;
  personnalisation?: {
    texte?: string;
    police?: string;
    couleur?: string[];
  };
  gravure?: {
    dimensions?: string;
  };
}
