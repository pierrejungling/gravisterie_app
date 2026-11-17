import { Gravure } from "./gravure.entity";
import { Couleur } from "./enum";
export declare class Personnalisation {
    id_personnalisation: string;
    texte: string;
    police: string | null;
    fichier_source: string | null;
    informations_supplémentaires: string | null;
    couleur: Couleur[] | null;
    gravure: Gravure;
}
