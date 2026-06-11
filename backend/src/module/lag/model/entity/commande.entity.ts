import { Column, PrimaryColumn, Entity, ManyToOne, JoinColumn, OneToMany} from "typeorm";
import { ulid } from "ulid";
import { StatutCommande } from "./enum";
import { Client } from "./client.entity";
import { CommandeSupport } from "./commande_support.entity";


@Entity()
export class Commande {
    @PrimaryColumn('varchar', { length:26, default: () => `'${ulid()}'` })
    id_commande : string;

    @Column({type: 'timestamp', nullable: false})
    date_commande: Date;

    @Column({type: 'timestamp', nullable: true})
    deadline: Date | null;

    @Column({type: 'varchar', nullable: true})
    produit: string | null;
    
    @Column({type: 'text', nullable: true})
    description: string | null;

    @Column({type: 'text', nullable: true})
    fichiers_joints: string | null;

    @Column({type: 'boolean', default: false})
    CGV_acceptée: boolean;

    @Column({type: 'boolean', default: false})
    newsletter_acceptée: boolean;

    @Column({type: 'varchar', nullable: false, default: StatutCommande.EN_ATTENTE_INFORMATION})
    statut_commande: StatutCommande;

    @Column({type: 'simple-array', nullable: true})
    statuts_actifs: StatutCommande[] | null;

    @Column({type: 'decimal', nullable: true})
    prix_final: number | null;
    
    @Column({type: 'decimal', nullable: true})
    prix_unitaire_final: number | null;

    @Column({type: 'decimal', nullable: true})
    frais_pourcentage: number | null;

    @Column({type: 'varchar', nullable: true})
    frais_commission_id: string | null;

    @Column({type: 'varchar', nullable: true})
    frais_commission_libelle: string | null;

    @Column({type: 'integer', nullable: true})
    quantité: number | null;

    @Column({type: 'integer', nullable: true, default: 0})
    quantite_realisee: number | null;

    /** Compteurs étiquetés (JSON) pour la quantité produite ; null = ancien comportement uniquement avec quantité / quantite_realisee. */
    @Column({type: 'text', nullable: true})
    quantite_produit_compteurs: string | null;

    @OneToMany(() => CommandeSupport, (commandeSupport) => commandeSupport.commande, { cascade: true })
    supports: CommandeSupport[];

    @Column({type: 'boolean', default: false})
    payé: boolean;

    @Column({type: 'text', nullable: true})
    commentaire_paye: string | null;

    @Column({type: 'boolean', default: false})
    attente_reponse: boolean; // false = client attend réponse, true = moi qui attends réponse

    @Column({type: 'varchar', nullable: true})
    mode_contact: string | null; // 'mail', 'tel', ou 'meta'

    /** Commande créée automatiquement depuis le site vitrine (webhook). */
    @Column({type: 'boolean', default: false})
    source_web: boolean;

    /** Commande site marquée comme traitée dans le kanban (retire la pastille « nouveau »). */
    @Column({type: 'boolean', default: false})
    site_traitee: boolean;

    @ManyToOne(() => Client, (client) => client.id_client)
    @JoinColumn({name: 'id_client'})
    client: Client;
}