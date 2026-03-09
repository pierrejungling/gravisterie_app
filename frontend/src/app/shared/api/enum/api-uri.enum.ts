export enum ApiURI {
  SIGN_IN = 'account/signin',
  ADMIN_SIGN_IN = 'account/admin-signin',
  SIGN_UP = 'account/signup',
  ME = 'account/me',
  REFRESH_TOKEN = 'account/refresh',
  AJOUTER_COMMANDE = 'commande/ajouter',
  LISTE_COMMANDES = 'commande/liste',
  UPDATE_STATUT_COMMANDE = 'commande/statut',
  GET_COMMANDE_BY_ID = 'commande',
  UPDATE_COMMANDE = 'commande',
  DELETE_COMMANDE = 'commande',
  LISTE_BONS = 'bon/liste',
  AJOUTER_BON = 'bon/ajouter',
  PROCHAIN_NUMERO_BON = 'bon/prochain-numero',
  UPDATE_BON = 'bon',
}
/** URL pour marquer un bon comme utilisé (remplacer :id par id_bon). */
export const BON_MARQUER_UTILISE = (idBon: string) => `bon/${idBon}/utilise`;
/** URL pour mettre à jour un bon (remplacer :id par id_bon). */
export const BON_UPDATE = (idBon: string) => `bon/${idBon}`;
/** URL pour supprimer un bon (remplacer :id par id_bon). */
export const BON_DELETE = (idBon: string) => `bon/${idBon}`;

/** URL pour l’upload d’un fichier sur une commande (remplacer :id par id_commande). */
export const COMMANDE_FICHIERS_UPLOAD = (idCommande: string) => `commande/${idCommande}/fichiers`;
/** URL pour la liste des fichiers d'une commande. */
export const COMMANDE_FICHIERS_LIST = (idCommande: string) => `commande/${idCommande}/fichiers`;
/** URL pour le téléchargement d'un fichier. */
export const COMMANDE_FICHIER_DOWNLOAD = (idCommande: string, idFichier: string) => `commande/${idCommande}/fichiers/${idFichier}/download`;
/** URL pour dupliquer une commande. */
export const COMMANDE_DUPLIQUER = (idCommande: string) => `commande/${idCommande}/dupliquer`;
