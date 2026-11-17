import { Commande } from "./commande.entity";
export declare class CommandeLignePrix {
    id_commande_ligne_prix: string;
    commande: Commande;
    remise: boolean;
    remise_pourcentage: boolean;
    nom: string | null;
    quantite: number | null;
    prix_unitaire: number | null;
    prix_final: number | null;
}
