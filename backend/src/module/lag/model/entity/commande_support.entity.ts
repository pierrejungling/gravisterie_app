import { Column, PrimaryColumn, Entity, ManyToOne, JoinColumn } from "typeorm";
import { ulid } from "ulid";
import { Commande } from "./commande.entity";

@Entity()
export class CommandeSupport {
    @PrimaryColumn('varchar', { length:26, default: () => `'${ulid()}'` })
    id_commande_support: string;

    @ManyToOne(() => Commande, (commande) => commande.id_commande, { onDelete: 'CASCADE' })
    @JoinColumn({name: 'id_commande'})
    commande: Commande;

    @Column({type: 'varchar', nullable: true})
    nom_support: string | null;

    @Column({type: 'decimal', nullable: true})
    prix_support: number | null;

    @Column({type: 'varchar', nullable: true})
    url_support: string | null;

    @Column({type: 'boolean', default: true})
    prix_unitaire: boolean; // true = prix unitaire, false = prix pour X unités

    @Column({type: 'integer', nullable: true})
    nombre_unites: number | null; // X unités si prix_unitaire = false

    @Column({type: 'decimal', nullable: true})
    prix_support_unitaire: number | null; // Calculé automatiquement
}
