import { Commande } from "./commande.entity";
export declare class CommandeSupport {
    id_commande_support: string;
    commande: Commande;
    nom_support: string | null;
    prix_support: number | null;
    url_support: string | null;
    prix_unitaire: boolean;
    nombre_unites: number | null;
    prix_support_unitaire: number | null;
    actif: boolean;
    id_ligne_prix: string | null;
}
