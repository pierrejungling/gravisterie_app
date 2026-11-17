"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ApercuLienService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApercuLienService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const promises_1 = require("dns/promises");
const net_1 = require("net");
const entity_1 = require("../model/entity");
const DUREE_OK = 30 * 24 * 3600 * 1000;
const DUREE_ECHEC = 12 * 3600 * 1000;
const TAILLE_MAX = 1_500_000;
const DELAI = 7000;
let ApercuLienService = ApercuLienService_1 = class ApercuLienService {
    repo;
    logger = new common_1.Logger(ApercuLienService_1.name);
    enCours = new Map();
    constructor(repo) {
        this.repo = repo;
    }
    async getApercu(brut, forcer = false) {
        const url = this.normaliser(brut);
        const cle = this.cle(url);
        const existant = await this.repo.findOne({ where: { cle } });
        if (existant && !forcer) {
            const age = Date.now() - new Date(existant.date_maj).getTime();
            if (existant.manuel || age < (existant.image ? DUREE_OK : DUREE_ECHEC))
                return this.vers(existant);
        }
        if (existant?.manuel && forcer)
            return this.vers(existant);
        const deja = this.enCours.get(cle);
        if (deja)
            return deja;
        const tache = this.charger(url, cle).finally(() => this.enCours.delete(cle));
        this.enCours.set(cle, tache);
        return tache;
    }
    async setImage(brut, image) {
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
            throw new common_1.BadRequestException("L'image doit être une adresse http(s).");
        }
        const existant = await this.repo.findOne({ where: { cle } });
        const ligne = existant ?? this.repo.create({ cle, url, titre: null, site: this.site(url) });
        ligne.image = propre;
        ligne.manuel = true;
        ligne.date_maj = new Date();
        return this.vers(await this.repo.save(ligne));
    }
    async charger(url, cle) {
        let image = null;
        let titre = null;
        let finale = url;
        try {
            await this.verifierHote(url);
            const res = await this.lire(url);
            finale = res.url || url;
            if (res.html) {
                image = this.meta(res.html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
                if (!image)
                    image = this.lienImage(res.html);
                titre = this.meta(res.html, ['og:title', 'twitter:title']) || this.titrePage(res.html);
                if (image)
                    image = this.absolue(image, finale);
            }
        }
        catch (e) {
            this.logger.debug(`Aperçu impossible pour ${url} : ${e.message}`);
        }
        if (!image)
            image = this.imageAmazon(finale) ?? this.imageAmazon(url);
        if (titre && /^(amazon\.[a-z.]+|page not found|robot check|captcha)/i.test(titre.trim()))
            titre = null;
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
    async lire(url) {
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
            if (type.startsWith('image/'))
                return { url: res.url, html: `<meta property="og:image" content="${res.url}">` };
            if (!res.ok || !type.includes('html') || !res.body)
                return { url: res.url, html: null };
            const lecteur = res.body.getReader();
            const morceaux = [];
            let taille = 0;
            while (taille < TAILLE_MAX) {
                const { done, value } = await lecteur.read();
                if (done || !value)
                    break;
                morceaux.push(value);
                taille += value.length;
            }
            lecteur.cancel().catch(() => undefined);
            return { url: res.url, html: Buffer.concat(morceaux).toString('utf8') };
        }
        finally {
            clearTimeout(minuteur);
        }
    }
    meta(html, noms) {
        for (const nom of noms) {
            const n = nom.replace(/[:.]/g, '\\$&');
            const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)["']`, 'i');
            const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i');
            const m = html.match(re1) || html.match(re2);
            if (m && m[1].trim())
                return this.decoder(m[1].trim());
        }
        return null;
    }
    lienImage(html) {
        const m = html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
        return m ? this.decoder(m[1]) : null;
    }
    titrePage(html) {
        const m = html.match(/<title[^>]*>([^<]{1,400})<\/title>/i);
        return m ? m[1].replace(/\s+/g, ' ').trim() || null : null;
    }
    imageAmazon(url) {
        try {
            const u = new URL(url);
            if (!/(^|\.)amazon\.[a-z.]+$|(^|\.)amzn\./i.test(u.hostname))
                return null;
            const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/ASIN)\/([A-Z0-9]{10})/i);
            return m ? `https://m.media-amazon.com/images/P/${m[1].toUpperCase()}.01._SCLZZZZZZZ_.jpg` : null;
        }
        catch {
            return null;
        }
    }
    absolue(image, base) {
        try {
            const u = new URL(image, base);
            return /^https?:$/.test(u.protocol) ? u.toString() : null;
        }
        catch {
            return null;
        }
    }
    decoder(texte) {
        return texte
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#0?39;|&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    }
    async verifierHote(url) {
        const hote = new URL(url).hostname.replace(/^\[|\]$/g, '');
        if (/^(localhost|.*\.local|.*\.internal)$/i.test(hote))
            throw new Error('hôte interne');
        const adresses = (0, net_1.isIP)(hote) ? [hote] : (await (0, promises_1.lookup)(hote, { all: true })).map((a) => a.address);
        if (adresses.some((a) => this.privee(a)))
            throw new Error('adresse privée');
    }
    privee(ip) {
        if (ip.includes(':'))
            return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:') && this.privee(ip.slice(7));
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
    }
    normaliser(brut) {
        let texte = (brut || '').trim();
        if (!texte)
            throw new common_1.BadRequestException('Lien manquant.');
        if (!/^https?:\/\//i.test(texte))
            texte = `https://${texte}`;
        try {
            const u = new URL(texte);
            if (!/^https?:$/.test(u.protocol))
                throw new Error();
            u.hash = '';
            return u.toString();
        }
        catch {
            throw new common_1.BadRequestException('Lien invalide.');
        }
    }
    cle(url) {
        return (0, crypto_1.createHash)('sha1').update(url).digest('hex');
    }
    site(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '').slice(0, 120);
        }
        catch {
            return null;
        }
    }
    vers(l) {
        return { url: l.url, image: l.image, titre: l.titre, site: l.site, manuel: l.manuel };
    }
};
exports.ApercuLienService = ApercuLienService;
exports.ApercuLienService = ApercuLienService = ApercuLienService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entity_1.ApercuLien)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ApercuLienService);
//# sourceMappingURL=apercu_lien.service.js.map