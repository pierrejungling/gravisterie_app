export type TypeEvenement = 'gravure_direct' | 'nocturne' | 'salon' | 'marche' | 'atelier' | 'autre';
export type StatutEvenement = 'prospect' | 'propose' | 'confirme' | 'termine' | 'annule' | 'refuse';
export type FormuleEvenement = 'a_definir' | 'illimite' | 'a_la_gravure' | 'stand';
export interface ElementMateriel {
    texte: string;
    fait: boolean;
}
export declare class Evenement {
    id_evenement: string;
    nom: string;
    type: TypeEvenement;
    statut: StatutEvenement;
    date_debut: Date | null;
    date_fin: Date | null;
    heure_arrivee: string | null;
    lieu: string | null;
    adresse: string | null;
    contact_nom: string | null;
    contact_telephone: string | null;
    contact_mail: string | null;
    id_client: string | null;
    formule: FormuleEvenement;
    prix_forfait: number | null;
    prix_gravure: number | null;
    nb_gravures: number | null;
    heures_sur_place: number | null;
    heures_trajet: number | null;
    forfait_carburant: number | null;
    paye: boolean;
    materiel: ElementMateriel[];
    notes: string | null;
    date_creation: Date;
}
