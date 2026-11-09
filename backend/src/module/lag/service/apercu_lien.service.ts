import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { ApercuLien } from '../model/entity';

export interface Apercu {
    url: string;
    image: string | null;
    titre: string | null;
    site: string | null;
    manuel: boolean;
}

const DUREE_OK = 30 * 24 * 3600 * 1000; // aperçu trouvé : gardé 30 jours
const DUREE_ECHEC = 12 * 3600 * 1000; // rien trouvé : nouvel essai après 12 h
const TAILLE_MAX = 1_500_000; // on lit au plus 1,5 Mo de la page
const DELAI = 7000;

/**
 * Aperçu des liens de frais : lit les balises de partage (og:image, twitter:image, titre)
 * comme le font les messageries. Pour Amazon, l'image publique du produit sert de secours.
 */
@Injectable()
export class ApercuLienService {
    private readonly logger = new Logger(ApercuLienService.name);
    /** Évite de charger deux fois la même page en même temps. */
    private readonly enCours = new Map<string, Promise<Apercu>>();

    constructor(@InjectRepository(ApercuLien) private readonly repo: Repository<ApercuLien>) {}

    async getApercu(brut: string, forcer = false): Promise<Apercu> {
        const url = this.normaliser(brut);
        const cle = this.cle(url);
        const existant = await this.repo.findOne({ where: { cle } });
        if (existant && !forcer) {
            const age = Date.now() - new Date(existant.date_maj).getTime();
            if (existant.manuel || age < (existant.image ? DUREE_OK : DUREE_ECHEC)) return this.vers(existant);
        }
        if (existant?.manuel && forcer) return this.vers(existant);

        const deja = this.enCours.get(cle);
        if (deja) return deja;
        const tache = this.charger(url, cle).finally(() => this.enCours.delete(cle));
        this.enCours.set(cle, tache);
        return tache;
    }

    async setImage(brut: string, image: string | null | undefined): Promise<Apercu> {
        const url = this.normaliser(brut);
        const cle = this.cle(url);
        const propre = (image || '').trim();
        if (!propre) {
            const existant = await this.repo.findOne({ where: { cle } });
            if (existant) {
                existant.manuel = false;
                existant.image = null;
                existant.date_maj = new Date(0);
                await this.repo.save(existant);
            }
            return this.getApercu(url, true);
        }
        if (!/^https?:\/\//i.test(propre) && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(propre)) {
            throw new BadRequestException("L'image doit être une adresse http(s).");
        }
        const existant = await this.repo.findOne({ where: { cle } });
        const ligne = existant ?? this.repo.create({ cle, url, titre: null, site: this.site(url) });
        ligne.image = propre;
        ligne.manuel = true;
        ligne.date_maj = new Date();
        return this.vers(await this.repo.save(ligne));
    }

    // ---------- interne ----------

    private async charger(url: string, cle: string): Promise<Apercu> {
        let image: string | null = null;
        let titre: string | null = null;
        let finale = url;
        try {
            await this.verifierHote(url);
            const res = await this.lire(url);
            finale = res.url || url;
            if (res.html) {
                image = this.meta(res.html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
                if (!image) image = this.lienImage(res.html);
                titre = this.meta(res.html, ['og:title', 'twitter:title']) || this.titrePage(res.html);
                if (image) image = this.absolue(image, finale);
            }
        } catch (e) {
            this.logger.debug(`Aperçu impossible pour ${url} : ${(e as Error).message}`);
        }
        if (!image) image = this.imageAmazon(finale) ?? this.imageAmazon(url);
        if (titre && /^(amazon\.[a-z.]+|page not found|robot check|captcha)/i.test(titre.trim())) titre = null;

        const ligne = this.repo.create({
            cle,
            url,
            image,
            titre: titre ? this.decoder(titre).trim().slice(0, 300) : null,
            site: this.site(finale),
            manuel: false,
            date_maj: new Date(),
        });
        return this.vers(await this.repo.save(ligne));
    }

    private async lire(url: string): Promise<{ url: string; html: string | null }> {
        const controle = new AbortController();
        const minuteur = setTimeout(() => controle.abort(), DELAI);
        try {
            const res = await fetch(url, {
                redirect: 'follow',
                signal: controle.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GravisterieApercu/1.0; +https://gravisterie.be)',
                    Accept: 'text/html,application/xhtml+xml',
                    'Accept-Language': 'fr-BE,fr;q=0.9,en;q=0.6',
                },
            });
            const type = res.headers.get('content-type') || '';
            if (type.startsWith('image/')) return { url: res.url, html: `<meta property="og:image" content="${res.url}">` };
            if (!res.ok || !type.includes('html') || !res.body) return { url: res.url, html: null };
            const lecteur = res.body.getReader();
            const morceaux: Uint8Array[] = [];
            let taille = 0;
            while (taille < TAILLE_MAX) {
                const { done, value } = await lecteur.read();
                if (done || !value) break;
                morceaux.push(value);
                taille += value.length;
            }
            lecteur.cancel().catch(() => undefined);
            return { url: res.url, html: Buffer.concat(morceaux).toString('utf8') };
        } finally {
            clearTimeout(minuteur);
        }
    }

    private meta(html: string, noms: string[]): string | null {
        for (const nom of noms) {
            const n = nom.replace(/[:.]/g, '\\$&');
            const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i');
            const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i');
            const m = html.match(re1) || html.match(re2);
            if (m && m[1].trim()) return this.decoder(m[1].trim());
        }
        return null;
    }

    private lienImage(html: string): string | null {
        const m = html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
        return m ? this.decoder(m[1]) : null;
    }

    private titrePage(html: string): string | null {
        const m = html.match(/<title[^>]*>([^<]{1,400})<\/title>/i);
        return m ? m[1].replace(/\s+/g, ' ').trim() || null : null;
    }

    /** Amazon : image publique du produit à partir de son code ASIN. */
    private imageAmazon(url: string): string | null {
        try {
            const u = new URL(url);
            if (!/(^|\.)amazon\.[a-z.]+$|(^|\.)amzn\./i.test(u.hostname)) return null;
            const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/ASIN)\/([A-Z0-9]{10})/i);
            return m ? `https://m.media-amazon.com/images/P/${m[1].toUpperCase()}.01._SCLZZZZZZZ_.jpg` : null;
        } catch {
            return null;
        }
    }

    private absolue(image: string, base: string): string | null {
        try {
            const u = new URL(image, base);
            return /^https?:$/.test(u.protocol) ? u.toString() : null;
        } catch {
            return null;
        }
    }

    private decoder(texte: string): string {
        return texte
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#0?39;|&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    }

    /** Refuse les adresses internes (le serveur ne doit pas servir de relais vers son propre réseau). */
    private async verifierHote(url: string): Promise<void> {
        const hote = new URL(url).hostname.replace(/^\[|\]$/g, '');
        if (/^(localhost|.*\.local|.*\.internal)$/i.test(hote)) throw new Error('hôte interne');
        const adresses = isIP(hote) ? [hote] : (await lookup(hote, { all: true })).map((a) => a.address);
        if (adresses.some((a) => this.privee(a))) throw new Error('adresse privée');
    }

    private privee(ip: string): boolean {
        if (ip.includes(':')) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:') && this.privee(ip.slice(7));
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
    }

    private normaliser(brut: string): string {
        let texte = (brut || '').trim();
        if (!texte) throw new BadRequestException('Lien manquant.');
        if (!/^https?:\/\//i.test(texte)) texte = `https://${texte}`;
        try {
            const u = new URL(texte);
            if (!/^https?:$/.test(u.protocol)) throw new Error();
            u.hash = '';
            return u.toString();
        } catch {
            throw new BadRequestException('Lien invalide.');
        }
    }

    private cle(url: string): string {
        return createHash('sha1').update(url).digest('hex');
    }

    private site(url: string): string | null {
        try {
            return new URL(url).hostname.replace(/^www\./, '').slice(0, 120);
        } catch {
            return null;
        }
    }

    private vers(l: ApercuLien): Apercu {
        return { url: l.url, image: l.image, titre: l.titre, site: l.site, manuel: l.manuel };
    }
}
