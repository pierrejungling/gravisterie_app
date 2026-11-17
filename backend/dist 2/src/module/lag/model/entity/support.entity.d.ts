import { TypeMateriaux } from "./enum";
import { Gravure } from "./gravure.entity";
export declare class Support {
    id_support: string;
    nom_support: string;
    type_matériaux: TypeMateriaux | null;
    dimensions: string | null;
    prix_support: number | null;
    url_support: string | null;
    gravure: Gravure;
}
