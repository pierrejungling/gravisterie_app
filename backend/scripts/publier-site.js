/**
 * Publie products-data.js et projects-data.js sur R2 depuis la base, avec la connexion wrangler
 * (utile en local ; l'app, elle, publie toute seule après chaque modification).
 *   node scripts/publier-site.js [--ecrire-local <dossier>]   (écrit aussi une copie pour comparer)
 */
require('dotenv').config();
const fs = require('fs'), os = require('os'), path = require('path');
const { Client } = require('pg');
const BUCKET = process.env.R2_SITE_BUCKET_NAME || 'gravisterie-site';
const ACCOUNT = process.env.R2_ACCOUNT_ID || '58dcd0759eea7dc927400d57d4ba07b7';
const BASE = process.env.R2_SITE_PUBLIC_URL.replace(/\/+$/, '');

async function envoyer(cle, texte) {
    const jeton = fs.readFileSync(path.join(os.homedir(), 'Library/Preferences/.wrangler/config/default.toml'), 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)[1];
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${cle}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=60, must-revalidate' }, body: texte });
    if (!r.ok) throw new Error(`${cle} : ${r.status} ${await r.text()}`);
}
const urls = (v) => typeof v === 'string' ? (v.startsWith('img/') ? `${BASE}/${v}` : v) : Array.isArray(v) ? v.map(urls) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, urls(x)])) : v;

(async () => {
    const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
    await db.connect();
    for (const [type, nom, fichier] of [['produit', 'PRODUCTS_DATA', 'products-data.js'], ['projet', 'PROJECTS_DATA', 'projects-data.js']]) {
        const { rows: tous } = await db.query('SELECT * FROM site_item WHERE type=$1 ORDER BY ordre, nom', [type]);
        const fiche = (i, enfant) => {
            const f = { id: i.slug, name: i.nom, ...(enfant ? {} : { category: i.categories }), ...urls(i.donnees) };
            if (!enfant) { if (!i.visible) f.visible = false; else if (i.donnees?.visible === true) f.visible = true; }
            f.images = i.images.map((k) => `${BASE}/${k}`);
            return f;
        };
        const liste = tous.filter((i) => !i.parent_id).map((i) => {
            const f = fiche(i, false);
            const e = tous.filter((x) => x.parent_id === i.id && x.visible);
            if (e.length) { f.kind = 'collection'; f.items = e.map((x) => fiche(x, true)); }
            return f;
        });
        const rows = liste;
        const texte = `// Généré par l'app La Gravisterie. Ne pas modifier à la main.\nwindow.${nom} = ${JSON.stringify(liste)};\n`;
        await envoyer(`data/${fichier}`, texte);
        console.log(`${fichier} : ${liste.length} fiches publiées (${(texte.length / 1024).toFixed(0)} Ko)`);
    }
    await db.end();
})().catch((e) => { console.error(e); process.exit(1); });
