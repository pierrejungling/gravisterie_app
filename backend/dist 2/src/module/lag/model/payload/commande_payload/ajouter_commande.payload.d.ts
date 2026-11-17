import { Couleur } from '../../entity/enum';
export declare class CoordonneesContactPayload {
    nom?: string;
    prenom?: string;
    telephone?: string;
    mail?: string;
    societe?: string;
    adresse?: string;
    tva?: string;
}
export declare class AjouterCommandePayload {
    nom_commande: string;
    deadline?: string;
    date_commande?: string;
    coordonnees_contact?: CoordonneesContactPayload;
    description_projet?: string;
    dimensions_souhaitees?: string;
    couleur?: Couleur[];
    support?: string;
    police_ecriture?: string;
    texte_personnalisation?: string;
    fichiers_joints?: string[];
    quantité?: number;
    payé?: boolean;
    commentaire_paye?: string;
    statut_initial?: string;
    attente_reponse?: boolean;
    mode_contact?: string;
    prix_final?: number;
    prix_unitaire_final?: number;
    lignes_prix?: Array<{
        id?: string | null;
        remise?: boolean | null;
        remise_pourcentage?: boolean | null;
        nom?: string | null;
        quantite?: number | null;
        prix_unitaire?: number | null;
        prix_final?: number | null;
    }>;
    supports?: Array<{
        nom_support?: string;
        prix_support?: number;
        url_support?: string;
        prix_unitaire?: boolean;
        nombre_unites?: number;
        prix_support_unitaire?: number;
        actif?: boolean;
        id_ligne_prix?: string | null;
    }>;
    forcer_nouveau_client?: boolean;
    nouvelle_fiche_client?: boolean;
    id_client?: string;
    frais_pourcentage?: number;
    frais_commission_id?: string | null;
    frais_commission_libelle?: string | null;
}
