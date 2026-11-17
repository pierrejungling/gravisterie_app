import type { ElementMateriel, FormuleEvenement, StatutEvenement, TypeEvenement } from '../entity/evenement.entity';
export declare const TYPES_EVENEMENT: TypeEvenement[];
export declare const STATUTS_EVENEMENT: StatutEvenement[];
export declare const FORMULES_EVENEMENT: FormuleEvenement[];
export declare class EvenementPayload {
    nom?: string;
    type?: TypeEvenement;
    statut?: StatutEvenement;
    date_debut?: string | null;
    date_fin?: string | null;
    heure_arrivee?: string | null;
    lieu?: string | null;
    adresse?: string | null;
    contact_nom?: string | null;
    contact_telephone?: string | null;
    contact_mail?: string | null;
    id_client?: string | null;
    formule?: FormuleEvenement;
    prix_forfait?: number | null;
    prix_gravure?: number | null;
    nb_gravures?: number | null;
    heures_sur_place?: number | null;
    heures_trajet?: number | null;
    forfait_carburant?: number | null;
    paye?: boolean;
    materiel?: ElementMateriel[];
    notes?: string | null;
}
export declare class LierCommandeEvenementPayload {
    id_commande: string;
}
