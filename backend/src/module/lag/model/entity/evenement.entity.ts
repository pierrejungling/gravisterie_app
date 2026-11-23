import { Column, Entity, PrimaryColumn } from 'typeorm';

export type TypeEvenement = 'gravure_direct' | 'nocturne' | 'salon' | 'marche' | 'atelier' | 'autre';
export type StatutEvenement = 'prospect' | 'propose' | 'confirme' | 'termine' | 'annule' | 'refuse';
export type FormuleEvenement = 'a_definir' | 'illimite' | 'a_la_gravure' | 'stand';

/** Une ligne de la liste de matériel / préparation. */
export interface ElementMateriel {
    texte: string;
    fait: boolean;
}

/** Coupures comptées dans le décompte de caisse (clé = valeur en euros). */
export const COUPURES_CAISSE = ['100', '50', '20', '10', '5', '2', '1', '0.5', '0.2', '0.1'] as const;
export type CoupureCaisse = (typeof COUPURES_CAISSE)[number];

/**
 * Compte caisse d'un événement (cash avant / après, autres moyens de paiement, frais).
 * Seules les saisies sont stockées ; les totaux sont recalculés à l'affichage.
 */
export interface CaisseEvenement {
    /** Cash en caisse avant l'événement (fond de caisse emporté). */
    cash_avant: number | null;
    /** Nombre de billets / pièces par coupure après l'événement. */
    coupures: Partial<Record<CoupureCaisse, number>>;
    ca_facture: number | null;
    ca_sumup: number | null;
    ca_qr: number | null;
    /** Montant déposé à la banque (vide = tout le CA cash). */
    depot_banque: number | null;
    frais: number | null;
}

/**
 * Événement : gravure en direct en magasin, nocturne, salon, marché...
 * Les commandes passées pendant ou pour l'événement y sont rattachées (commande.id_evenement).
 */
@Entity()
export class Evenement {
    @PrimaryColumn('varchar', { length: 26 })
    id_evenement: string;

    @Column({ type: 'varchar', length: 200 })
    nom: string;

    @Column({ type: 'varchar', length: 30, default: 'gravure_direct' })
    type: TypeEvenement;

    @Column({ type: 'varchar', length: 20, default: 'propose' })
    statut: StatutEvenement;

    @Column({ type: 'timestamptz', nullable: true })
    date_debut: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    date_fin: Date | null;

    /** Heure d'arrivée / d'installation (texte libre, ex. « 15 h 30 »). */
    @Column({ type: 'varchar', length: 40, nullable: true })
    heure_arrivee: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true })
    lieu: string | null;

    @Column({ type: 'text', nullable: true })
    adresse: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    contact_nom: string | null;

    @Column({ type: 'varchar', length: 60, nullable: true })
    contact_telephone: string | null;

    @Column({ type: 'varchar', length: 200, nullable: true })
    contact_mail: string | null;

    /** Fiche client de l'organisateur (celui qui paie la prestation). */
    @Column({ type: 'varchar', length: 26, nullable: true })
    id_client: string | null;

    @Column({ type: 'varchar', length: 20, default: 'a_definir' })
    formule: FormuleEvenement;

    /** Prix de la prestation HTVA (forfait, ou partie fixe de la formule à la gravure). */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    prix_forfait: number | null;

    /** Prix par gravure (formule à la gravure). */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    prix_gravure: number | null;

    @Column({ type: 'integer', nullable: true })
    nb_gravures: number | null;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    heures_sur_place: number | null;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    heures_trajet: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    forfait_carburant: number | null;

    @Column({ type: 'boolean', default: false })
    paye: boolean;

    @Column({ type: 'jsonb', default: () => `'[]'` })
    materiel: ElementMateriel[];

    @Column({ type: 'text', nullable: true })
    notes: string | null;

    /**
     * Vente (commande) qui porte la prestation de l'événement. Quand elle existe, le CA de la
     * prestation vient de cette vente et le forfait calculé n'est plus ajouté (évite le doublon).
     */
    @Column({ type: 'varchar', length: 26, nullable: true })
    id_commande_prestation: string | null;

    /** Compte caisse de l'événement (null tant qu'il n'est pas ouvert). */
    @Column({ type: 'jsonb', nullable: true })
    caisse: CaisseEvenement | null;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    date_creation: Date;
}
