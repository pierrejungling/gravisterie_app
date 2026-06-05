import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ulid } from 'ulid';

@Entity()
export class FraisCommission {
    @PrimaryColumn('varchar', { length: 26, default: () => `'${ulid()}'` })
    id_frais_commission: string;

    @Column({ type: 'varchar', length: 100, nullable: false })
    libelle: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false })
    pourcentage: number;
}
