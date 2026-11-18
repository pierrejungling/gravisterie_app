import { Injectable, Logger } from '@nestjs/common';

export interface AbonnesCompte {
    nom: string;
    facebook: number | null;
    instagram: { username: string; abonnes: number } | null;
}

export interface AbonnesResultat {
    comptes: AbonnesCompte[];
    mis_a_jour: string;
}

interface MetaPageConfig {
    label: string;
    pageId: string;
    token: string;
}

const TTL_MS = 10 * 60 * 1000;
const GRAPH = 'https://graph.facebook.com/v21.0';

@Injectable()
export class ReseauxService {
    private readonly logger = new Logger(ReseauxService.name);
    private cache: { data: AbonnesResultat; at: number } | null = null;

    private lireConfig(): MetaPageConfig[] {
        const brut = process.env.META_PAGES;
        if (!brut) return [];
        try {
            const liste = JSON.parse(brut);
            return Array.isArray(liste) ? liste : [];
        } catch {
            this.logger.error('META_PAGES invalide (JSON attendu)');
            return [];
        }
    }

    async getAbonnes(ttlMs: number = TTL_MS): Promise<AbonnesResultat> {
        if (this.cache && Date.now() - this.cache.at < ttlMs) return this.cache.data;
        const pages = this.lireConfig();
        const comptes = await Promise.all(pages.map((p) => this.lirePage(p)));
        const data: AbonnesResultat = { comptes, mis_a_jour: new Date().toISOString() };
        this.cache = { data, at: Date.now() };
        return data;
    }

    private async lirePage(p: MetaPageConfig): Promise<AbonnesCompte> {
        const url = `${GRAPH}/${p.pageId}?fields=followers_count,fan_count,instagram_business_account{username,followers_count}&access_token=${encodeURIComponent(p.token)}`;
        try {
            const res = await fetch(url);
            const json: any = await res.json();
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
        } catch (e) {
            this.logger.error(`Meta ${p.label}: ${(e as Error).message}`);
            return { nom: p.label, facebook: null, instagram: null };
        }
    }
}
