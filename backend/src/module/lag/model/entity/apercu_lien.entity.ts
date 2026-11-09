import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Aperçu d'un lien (frais, supports achetés) : image et titre de la page.
 * Mémorisé pour ne pas recharger la page à chaque affichage.
 */
@Entity()
export class ApercuLien {
    /** Empreinte sha1 de l'URL. */
    @PrimaryColumn('varchar', { length: 40 })
    cle: string;

    @Column({ type: 'text' })
    url: string;

    @Column({ type: 'text', nullable: true })
    image: string | null;

    @Column({ type: 'varchar', length: 300, nullable: true })
    titre: string | null;

    @Column({ type: 'varchar', length: 120, nullable: true })
    site: string | null;

    /** true = image choisie à la main, jamais remplacée automatiquement. */
    @Column({ type: 'boolean', default: false })
    manuel: boolean;

    @Column({ type: 'timestamptz' })
    date_maj: Date;
}
