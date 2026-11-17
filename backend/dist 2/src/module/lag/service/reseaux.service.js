"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ReseauxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReseauxService = void 0;
const common_1 = require("@nestjs/common");
const TTL_MS = 10 * 60 * 1000;
const GRAPH = 'https://graph.facebook.com/v21.0';
let ReseauxService = ReseauxService_1 = class ReseauxService {
    logger = new common_1.Logger(ReseauxService_1.name);
    cache = null;
    lireConfig() {
        const brut = process.env.META_PAGES;
        if (!brut)
            return [];
        try {
            const liste = JSON.parse(brut);
            return Array.isArray(liste) ? liste : [];
        }
        catch {
            this.logger.error('META_PAGES invalide (JSON attendu)');
            return [];
        }
    }
    async getAbonnes() {
        if (this.cache && this.cache.expire > Date.now())
            return this.cache.data;
        const pages = this.lireConfig();
        const comptes = await Promise.all(pages.map((p) => this.lirePage(p)));
        const data = { comptes, mis_a_jour: new Date().toISOString() };
        this.cache = { data, expire: Date.now() + TTL_MS };
        return data;
    }
    async lirePage(p) {
        const url = `${GRAPH}/${p.pageId}?fields=followers_count,fan_count,instagram_business_account{username,followers_count}&access_token=${encodeURIComponent(p.token)}`;
        try {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) {
                this.logger.error(`Meta ${p.label}: ${json?.error?.message ?? res.status}`);
                return { nom: p.label, facebook: null, instagram: null };
            }
            const ig = json.instagram_business_account;
            return {
                nom: p.label,
                facebook: json.followers_count ?? json.fan_count ?? null,
                instagram: ig ? { username: ig.username, abonnes: ig.followers_count } : null,
            };
        }
        catch (e) {
            this.logger.error(`Meta ${p.label}: ${e.message}`);
            return { nom: p.label, facebook: null, instagram: null };
        }
    }
};
exports.ReseauxService = ReseauxService;
exports.ReseauxService = ReseauxService = ReseauxService_1 = __decorate([
    (0, common_1.Injectable)()
], ReseauxService);
//# sourceMappingURL=reseaux.service.js.map