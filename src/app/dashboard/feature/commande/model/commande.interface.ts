export interface CoordonneesContact {
  nom: string;
  prenom: string;
  telephone: string;
  mail: string;
  adresse?: string;
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
  statuts_initiaux?: string[];
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

export interface Client {
  id_client: string;
  nom?: string;
  prénom?: string;
  mail?: string | null;
  téléphone?: string | null;
  adresse?: string;
  tva?: string;
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
  payé?: boolean;
  commentaire_paye?: string;
  client: Client;
  support?: {
    nom_support?: string;
    prix_support?: number;
    url_support?: string;
  };
  personnalisation?: {
    texte?: string;
    police?: string;
    couleur?: string[];
  };
  gravure?: {
    dimensions?: string;
  };
}
