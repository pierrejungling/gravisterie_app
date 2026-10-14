import { Column, PrimaryColumn, Entity, ManyToOne, JoinColumn } from "typeorm";
import { ulid } from "ulid";
import { Commande } from "./commande.entity";

@Entity()
export class CommandeLignePrix {
    @PrimaryColumn('varchar', { length: 26, default: () => `'${ulid()}'` })
    id_commande_ligne_prix: string;

    @ManyToOne(() => Commande, (commande) => commande.lignes_prix, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_commande' })
    commande: Commande;

    @Column({ type: 'boolean', default: false })
    remise: boolean;

    @Column({ type: 'boolean', default: false })
    remise_pourcentage: boolean;

    @Column({ type: 'varchar', nullable: true })
    nom: string | null;

    @Column({ type: 'integer', nullable: true })
    quantite: number | null;

    @Column({ type: 'decimal', nullable: true })
    prix_unitaire: number | null;

    @Column({ type: 'decimal', nullable: true })
    prix_final: number | null;
}
