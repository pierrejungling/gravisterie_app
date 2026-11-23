import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { SiteItem, SiteItemType } from '../model/entity';
import { SiteItemPayload } from '../model/payload';
import { SiteR2Service } from './site_r2.service';
import { SITE_SEED } from './site_seed';

const CACHE_IMAGE = 'public, max-age=31536000, immutable';
const CACHE_DONNEES = 'public, max-age=60, must-revalidate';

export function slugifier(texte: string): string {
    return texte
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100);
}

@Injectable()
export class SiteService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SiteService.name);
    private minuteur: NodeJS.Timeout | null = null;

    constructor(
        @InjectRepository(SiteItem) private readonly repo: Repository<SiteItem>,
        private readonly r2: SiteR2Service,
    ) {}

    /** Première mise en route : remplit la table avec les fiches du site actuel, puis publie. */
    async onApplicationBootstrap() {
        try {
            if ((await this.repo.count()) > 0) return;
            const ids = new Map<string, string>();
            for (const f of SITE_SEED.filter((x) => !x.parent_slug)) {
                const { parent_slug, ...champs } = f;
                const sauve = await this.repo.save(this.repo.create({ ...champs, parent_id: null, date_maj: new Date() } as any) as unknown as SiteItem);
                ids.set(`${f.type}|${f.slug}`, sauve.id);
            }
            for (const f of SITE_SEED.filter((x) => x.parent_slug)) {
                const { parent_slug, ...champs } = f;
                await this.repo.save(this.repo.create({ ...champs, parent_id: ids.get(`${f.type}|${parent_slug}`) ?? null, date_maj: new Date() } as any) as unknown as SiteItem);
            }
            this.logger.log(`Site vitrine : ${SITE_SEED.length} fiches importées`);
            this.programmerPublication();
        } catch (e) {
            this.logger.error(`Import initial du site impossible : ${(e as Error).message}`);
        }
    }

    async lister(type?: SiteItemType) {
        const items = await this.repo.find({ where: type ? { type } : {}, order: { type: 'ASC', ordre: 'ASC', nom: 'ASC' } });
        const nb = new Map<string, number>();
        for (const i of items) if (i.parent_id) nb.set(i.parent_id, (nb.get(i.parent_id) ?? 0) + 1);
        return items.map((i) => Object.assign(this.avecUrls(i), { nbEnfants: nb.get(i.id) ?? 0 }));
    }

    /** Chiffres pour le tableau de bord. */
    async resume(): Promise<{ produits: number; projets: number; masques: number; sansPhoto: number }> {
        const items = (await this.repo.find({ select: ['id', 'type', 'visible', 'images', 'parent_id'] })).filter((i) => !i.parent_id);
        return {
            produits: items.filter((i) => i.type === 'produit').length,
            projets: items.filter((i) => i.type === 'projet').length,
            masques: items.filter((i) => !i.visible).length,
            sansPhoto: items.filter((i) => !(i.images ?? []).length).length,
        };
    }

    async obtenir(id: string) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Élément introuvable');
        const enfants = await this.repo.find({ where: { parent_id: id }, order: { ordre: 'ASC', nom: 'ASC' } });
        const parent = item.parent_id ? await this.repo.findOne({ where: { id: item.parent_id } }) : null;
        return Object.assign(this.avecUrls(item), {
            enfants: enfants.map((e) => this.avecUrls(e)),
            parent: parent ? { id: parent.id, nom: parent.nom, slug: parent.slug } : null,
        });
    }

    async categories(): Promise<{ type: SiteItemType; categorie: string; nombre: number }[]> {
        const items = (await this.repo.find()).filter((i) => !i.parent_id);
        const m = new Map<string, number>();
        for (const i of items) for (const c of i.categories ?? []) m.set(`${i.type}|${c}`, (m.get(`${i.type}|${c}`) ?? 0) + 1);
        return [...m.entries()]
            .map(([k, nombre]) => {
                const [type, categorie] = k.split('|');
                return { type: type as SiteItemType, categorie, nombre };
            })
            .sort((a, b) => a.type.localeCompare(b.type) || a.categorie.localeCompare(b.categorie));
    }

    async creer(p: SiteItemPayload) {
        if (!p.nom?.trim()) throw new BadRequestException('Le nom est obligatoire');
        const parent = p.parent_id ? await this.repo.findOne({ where: { id: p.parent_id } }) : null;
        if (p.parent_id && !parent) throw new BadRequestException('Collection introuvable');
        const type = parent?.type ?? p.type ?? 'produit';
        let slug: string;
        if (p.slug?.trim()) {
            // Identifiant choisi par l'utilisateur : on le garde tel quel (nettoyé), ou on refuse s'il est déjà pris.
            slug = slugifier(p.slug);
            if (!slug) throw new BadRequestException('Identifiant invalide');
            if (await this.repo.findOne({ where: { type, slug } })) {
                throw new ConflictException({ code: 'site.id_pris', message: 'Cet identifiant est déjà utilisé par une autre fiche.' });
            }
        } else {
            slug = await this.slugLibre(type, slugifier(p.nom));
        }
        const dernier = await this.repo
            .createQueryBuilder('i')
            .select('MAX(i.ordre)', 'max')
            .where('i.type = :type', { type })
            .andWhere(parent ? 'i.parent_id = :pid' : 'i.parent_id IS NULL', parent ? { pid: parent.id } : {})
            .getRawOne();
        const item = this.repo.create({
            type,
            parent_id: parent?.id ?? null,
            slug,
            nom: p.nom.trim(),
            categories: p.categories ?? [],
            visible: p.visible ?? true,
            ordre: p.ordre ?? (dernier?.max ?? 0) + 1,
            images: [],
            donnees: p.donnees ?? {},
            date_maj: new Date(),
        });
        const sauve = await this.repo.save(item);
        this.programmerPublication();
        return this.avecUrls(sauve);
    }

    async modifier(id: string, p: SiteItemPayload) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Élément introuvable');
        // La fiche a été modifiée ailleurs depuis que l'utilisateur l'a ouverte : on refuse d'écraser.
        if (p.base && new Date(p.base).getTime() !== new Date(item.date_maj).getTime()) {
            throw new ConflictException({ code: 'site.conflit', message: 'Cette fiche a été modifiée ailleurs entre-temps.' });
        }
        if (p.nom !== undefined) item.nom = p.nom.trim();
        if (p.slug !== undefined && p.slug.trim() && p.slug.trim() !== item.slug) {
            const voulu = slugifier(p.slug);
            const pris = voulu ? await this.repo.findOne({ where: { type: item.type, slug: voulu } }) : null;
            if (pris && pris.id !== id) throw new ConflictException({ code: 'site.id_pris', message: 'Cet identifiant est déjà utilisé par une autre fiche.' });
            if (voulu) item.slug = voulu;
        }
        if (p.categories !== undefined) item.categories = p.categories;
        if (p.visible !== undefined) item.visible = p.visible;
        if (p.ordre !== undefined) item.ordre = p.ordre;
        if (p.donnees !== undefined) item.donnees = p.donnees;
        item.date_maj = new Date();
        const sauve = await this.repo.save(item);
        this.programmerPublication();
        return this.avecUrls(sauve);
    }

    async supprimer(id: string) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Élément introuvable');
        const enfants = await this.repo.find({ where: { parent_id: id } });
        await this.repo.delete({ parent_id: id });
        await this.repo.delete(id);
        // Les images sont supprimées de R2 sauf si une autre fiche les utilise encore.
        for (const cle of [...(item.images ?? []), ...enfants.flatMap((e) => e.images ?? [])]) await this.supprimerImageSiOrpheline(cle);
        this.programmerPublication();
    }

    async reordonner(ids: string[]) {
        await this.repo.manager.transaction(async (m) => {
            for (let i = 0; i < ids.length; i++) await m.update(SiteItem, ids[i], { ordre: i + 1, date_maj: new Date() });
        });
        this.programmerPublication();
    }

    /** Ajoute des photos : version 1400 px et miniature 480 px en WebP. */
    async ajouterImages(id: string, fichiers: Express.Multer.File[]) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Élément introuvable');
        const ajoutees: string[] = [];
        for (const f of fichiers) {
            const base = `img/${item.type === 'produit' ? 'products' : 'projects'}/${item.slug}/${randomBytes(5).toString('hex')}`;
            await this.envoyerImage(base, f.buffer);
            ajoutees.push(`${base}.webp`);
        }
        item.images = [...(item.images ?? []), ...ajoutees];
        item.date_maj = new Date();
        const sauve = await this.repo.save(item);
        this.programmerPublication();
        return this.avecUrls(sauve);
    }

    /** Fixe l'ordre des images ; une clé absente de la liste est retirée (et supprimée de R2). */
    async definirImages(id: string, images: string[]) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Élément introuvable');
        const retirees = (item.images ?? []).filter((k) => !images.includes(k));
        item.images = images.filter((k) => (item.images ?? []).includes(k));
        item.date_maj = new Date();
        const sauve = await this.repo.save(item);
        for (const cle of retirees) await this.supprimerImageSiOrpheline(cle);
        this.programmerPublication();
        return this.avecUrls(sauve);
    }

    /** Envoie une image déjà optimisée par la migration ou le module (grande + miniature). */
    async envoyerImage(base: string, source: Buffer): Promise<void> {
        const normale = await sharp(source).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        const petite = await sharp(source).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        await this.r2.put(`${base}.webp`, normale, 'image/webp', CACHE_IMAGE);
        await this.r2.put(`${base}-sm.webp`, petite, 'image/webp', CACHE_IMAGE);
    }

    private async supprimerImageSiOrpheline(cle: string) {
        const encore = await this.repo
            .createQueryBuilder('i')
            .where('i.images @> :cle::jsonb', { cle: JSON.stringify([cle]) })
            .getCount();
        if (encore > 0) return;
        try {
            await this.r2.delete(cle);
            await this.r2.delete(cle.replace(/\.webp$/, '-sm.webp'));
        } catch (e) {
            this.logger.warn(`Suppression R2 impossible pour ${cle} : ${(e as Error).message}`);
        }
    }

    private async slugLibre(type: SiteItemType, voulu: string, sauf?: string): Promise<string> {
        let slug = voulu || 'element';
        let n = 2;
        for (;;) {
            const existe = await this.repo.findOne({ where: { type, slug } });
            if (!existe || existe.id === sauf) return slug;
            slug = `${voulu}-${n++}`;
        }
    }

    private avecUrls(i: SiteItem) {
        const base = this.r2.publicUrl;
        return Object.assign(i, { imagesUrl: (i.images ?? []).map((k) => `${base}/${k}`) });
    }

    // ---------- Publication ----------

    /** Regroupe les modifications rapprochées en une seule publication. */
    programmerPublication() {
        if (!this.r2.estConfigure()) return;
        if (this.minuteur) clearTimeout(this.minuteur);
        this.minuteur = setTimeout(() => {
            this.minuteur = null;
            this.publier().catch((e) => this.logger.error(`Publication impossible : ${(e as Error).message}`));
        }, 4000);
    }

    /** Écrit products-data.js et projects-data.js (même forme qu'avant) dans le bucket public. */
    async publier(): Promise<{ produits: number; projets: number; urlProduits: string; urlProjets: string }> {
        const [produits, projets] = await Promise.all([this.construire('produit'), this.construire('projet')]);
        const entete = (nom: string) => `// Généré par l'app La Gravisterie. Ne pas modifier à la main.\nwindow.${nom} = `;
        await this.r2.put('data/products-data.js', entete('PRODUCTS_DATA') + JSON.stringify(produits) + ';\n', 'application/javascript; charset=utf-8', CACHE_DONNEES);
        await this.r2.put('data/projects-data.js', entete('PROJECTS_DATA') + JSON.stringify(projets) + ';\n', 'application/javascript; charset=utf-8', CACHE_DONNEES);
        return {
            produits: produits.length,
            projets: projets.length,
            urlProduits: this.r2.url('data/products-data.js'),
            urlProjets: this.r2.url('data/projects-data.js'),
        };
    }

    private async construire(type: SiteItemType): Promise<any[]> {
        const tous = await this.repo.find({ where: { type }, order: { ordre: 'ASC', nom: 'ASC' } });
        const items = tous.filter((i) => !i.parent_id);
        const enfantsDe = new Map<string, SiteItem[]>();
        for (const e of tous.filter((i) => i.parent_id && i.visible)) enfantsDe.set(e.parent_id!, [...(enfantsDe.get(e.parent_id!) ?? []), e]);
        const base = this.r2.publicUrl;
        const urls = (v: any): any => {
            if (typeof v === 'string') return v.startsWith('img/') ? `${base}/${v}` : v;
            if (Array.isArray(v)) return v.map(urls);
            if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, urls(x)]));
            return v;
        };
        const fichePour = (i: SiteItem, enfant = false) => {
            const fiche: any = { id: i.slug, name: i.nom, ...(enfant ? {} : { category: i.categories }), ...urls(i.donnees) };
            if (!enfant) {
                if (!i.visible) fiche.visible = false;
                else if (i.donnees?.visible === true) fiche.visible = true;
            }
            fiche.images = (i.images ?? []).map((k) => `${base}/${k}`);
            return fiche;
        };
        return items.map((i) => {
            const fiche = fichePour(i);
            const enfants = enfantsDe.get(i.id);
            if (enfants?.length) {
                fiche.kind = 'collection';
                fiche.items = enfants.map((e) => fichePour(e, true));
            }
            return fiche;
        });
    }
}
