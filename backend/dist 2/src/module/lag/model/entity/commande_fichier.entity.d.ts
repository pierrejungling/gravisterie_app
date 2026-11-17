import { Commande } from './commande.entity';
export declare class CommandeFichier {
    id_fichier: string;
    key_r2: string;
    nom_fichier: string;
    type_mime: string | null;
    taille_octets: number | null;
    date_upload: Date;
    commande: Commande;
}
