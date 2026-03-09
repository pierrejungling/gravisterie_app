import { Column, PrimaryColumn, Entity } from 'typeorm';
import { ulid } from 'ulid';

@Entity()
export class Bon {
    @PrimaryColumn('varchar', { length: 26, default: () => `'${ulid()}'` })
    id_bon: string;

    @Column({ type: 'varchar', length: 20, nullable: false })
    numero: string;

    @Column({ type: 'varchar', length: 200, nullable: false })
    intitule: string;

    @Column({ type: 'date', nullable: false })
    date_creation: Date;

    @Column({ type: 'varchar', length: 50, nullable: true })
    nom: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    prenom: string | null;

    @Column({ type: 'varchar', length: 10, nullable: true })
    duree_validite: string | null;

    @Column({ type: 'date', nullable: true })
    date_echeance: Date | null;

    @Column({ type: 'boolean', default: false })
    utilise: boolean;

    @Column({ type: 'date', nullable: true })
    date_utilisation: Date | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    valeur: number | null;
}
