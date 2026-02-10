import { PrimaryColumn, Entity, Column } from "typeorm";
import { ulid } from "ulid";


@Entity()
export class Client {
    @PrimaryColumn('varchar', { length:26, default: () => `'${ulid()}'` })
    id_client : string;

    @Column({type: 'varchar', length: 50, nullable: true})
    nom: string | null;

    @Column({type: 'varchar', length: 50, nullable: true})
    prénom: string | null;

    @Column({type: 'varchar', length: 50, nullable: true})
    société: string | null;

    @Column({type: 'varchar', length: 50, nullable: true})
    mail: string | null;

    @Column({type: 'varchar', length: 30, nullable: true})
    téléphone: string | null;

    @Column({type: 'varchar', length: 100, nullable: true})
    adresse: string | null;

    @Column({type: 'varchar', length: 20, nullable: true})
    tva: string | null;
    
}