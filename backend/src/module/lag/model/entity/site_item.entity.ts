import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SiteItemType = 'produit' | 'projet';

/**
 * Produit (boutique) ou projet (réalisation) affiché sur le site vitrine gravisterie.be.
 * Les champs propres à un seul produit (priceDetails, variants, client...) restent dans `donnees`
 * pour que le site vitrine garde exactement la même forme de données qu'avant.
 */
@Entity('site_item')
@Index(['type', 'slug'], { unique: true })
export class SiteItem {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 10 })
    type: SiteItemType;

    /** Identifiant historique du site (`id` dans products-data.js), garde les liens existants. */
    @Column({ type: 'varchar', length: 120 })
    slug: string;

    /** Fiche « collection » à laquelle appartient ce modèle (ex. Boucles d'oreilles > Anneaux épais). */
    @Column({ type: 'uuid', nullable: true })
    @Index()
    parent_id: string | null;

    @Column({ type: 'varchar', length: 300 })
    nom: string;

    @Column({ type: 'jsonb', default: () => "'[]'" })
    categories: string[];

    @Column({ type: 'boolean', default: true })
    visible: boolean;

    @Column({ type: 'int', default: 0 })
    ordre: number;

    /** Clés R2 des images (ex. img/boucles/abc.webp), la première est l'image principale. */
    @Column({ type: 'jsonb', default: () => "'[]'" })
    images: string[];

    /** Tous les autres champs (price, description, keywords, features, material, items...). */
    @Column({ type: 'jsonb', default: () => "'{}'" })
    donnees: Record<string, any>;

    @Column({ type: 'timestamptz', default: () => 'now()' })
    date_maj: Date;
}
