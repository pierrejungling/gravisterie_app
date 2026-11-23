/**
 * Migration du site vitrine vers la base et R2 :
 *   node scripts/migrer-site.js <dossier du site vitrine> [--sans-images] [--publier]
 * - lit products-data.js et projects-data.js
 * - optimise les photos (WebP 1400 px + miniature 480 px) et les envoie dans le bucket R2 du site
 *   (par l'API Cloudflare avec la connexion `wrangler login`, ou par les clés S3 R2_SITE_*)
 * - crée/met à jour les lignes site_item (clé : type + slug), donc relançable sans doublon
 * Base : variables DB_* du .env (ou DATABASE_URL).
 */
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { Client } = require('pg');

const dossier = process.argv[2];
const sansImages = process.argv.includes('--sans-images');
if (!dossier) throw new Error('Indiquer le dossier du site vitrine');
const BUCKET = process.env.R2_SITE_BUCKET_NAME || 'gravisterie-site';
const ACCOUNT = process.env.R2_ACCOUNT_ID || '58dcd0759eea7dc927400d57d4ba07b7';

function jetonWrangler() {
    const f = path.join(os.homedir(), 'Library/Preferences/.wrangler/config/default.toml');
    const m = fs.readFileSync(f, 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/);
    if (!m) throw new Error('Pas de connexion wrangler (npx wrangler login)');
    return m[1];
}

async function envoyer(cle, buffer, type, cache) {
    const jeton = jetonWrangler();
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${cle.split('/').map(encodeURIComponent).join('/')}`;
    for (let essai = 1; essai <= 4; essai++) {
        const r = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': type, 'Cache-Control': cache }, body: buffer });
        if (r.ok) return;
        if (essai === 4) throw new Error(`Envoi ${cle} : ${r.status} ${(await r.text()).slice(0, 200)}`);
        await new Promise((ok) => setTimeout(ok, 800 * essai));
    }
}

function charger(fichier, nom) {
    global.window = {};
    delete require.cache[require.resolve(path.resolve(dossier, fichier))];
    require(path.resolve(dossier, fichier));
    return window[nom];
}

const cles = new Map(); // chemin source -> clé R2
const cleDe = (src) => {
    if (!cles.has(src)) cles.set(src, 'img/' + src.replace(/^assets\/images\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9/_-]+/g, '-') + '.webp');
    return cles.get(src);
};
const estImage = (v) => typeof v === 'string' && /^assets\/images\/(products|projects)\//.test(v);
const remplacer = (v) => {
    if (estImage(v)) return cleDe(v);
    if (Array.isArray(v)) return v.map(remplacer);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, remplacer(x)]));
    return v;
};

const CHAMPS_CLES = new Set(['id', 'name', 'category', 'images', 'image', 'visible', 'items']);

function versLigne(type, o, ordre) {
    const categories = [].concat(o.category ?? []).map((c) => ({ accesoires: 'accessoires', murale: 'deco-murale', 'personnalisé': 'perso', cadeaux: 'events' }[c] ?? c)).filter(Boolean);
    const donnees = {};
    for (const [k, v] of Object.entries(o)) if (!CHAMPS_CLES.has(k)) donnees[k] = remplacer(v);
    return { type, slug: o.id, parent_slug: null, nom: o.name, categories: [...new Set(categories)], visible: o.visible !== false, ordre, images: remplacer(o.images && o.images.length ? o.images : o.image ? [o.image] : []), donnees };
}

(async () => {
    const produits = charger('products-data.js', 'PRODUCTS_DATA');
    const projets = charger('projects-data.js', 'PROJECTS_DATA');
    const lignes = [...produits.map((o, i) => versLigne('produit', o, i + 1)), ...projets.map((o, i) => versLigne('projet', o, i + 1))];
    // Collections (ex. Boucles d'oreilles) : chaque modèle devient une fiche enfant.
    const enfants = [];
    for (const o of produits) {
        (o.items || []).forEach((it, n) => {
            const l = versLigne('produit', { ...it, category: [], visible: true }, n + 1);
            l.parent_slug = o.id;
            l.categories = [];
            enfants.push(l);
        });
    }
    lignes.push(...enfants);
    console.log(`${produits.length} produits, ${projets.length} projets, ${cles.size} images à envoyer`);

    if (!sansImages) {
        const liste = [...cles.entries()];
        let fait = 0, absentes = 0;
        const travailleur = async () => {
            while (liste.length) {
                const [src, cle] = liste.pop();
                const f = path.resolve(dossier, src);
                if (!fs.existsSync(f)) { absentes++; console.warn('Image absente :', src); continue; }
                const source = fs.readFileSync(f);
                const grande = await sharp(source).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
                const petite = await sharp(source).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
                const cache = 'public, max-age=31536000, immutable';
                await envoyer(cle, grande, 'image/webp', cache);
                await envoyer(cle.replace(/\.webp$/, '-sm.webp'), petite, 'image/webp', cache);
                if (++fait % 50 === 0) console.log(`  ${fait} images envoyées`);
            }
        };
        await Promise.all(Array.from({ length: 6 }, travailleur));
        console.log(`Images : ${fait} envoyées, ${absentes} absentes`);
    }

    const db = new Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } } : {
        host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE,
    });
    await db.connect();
    const idParSlug = new Map();
    for (const l of lignes) {
        const parent = l.parent_slug ? idParSlug.get(`${l.type}|${l.parent_slug}`) : null;
        const { rows } = await db.query(
            `INSERT INTO site_item (type, slug, parent_id, nom, categories, visible, ordre, images, donnees, date_maj)
             VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb, now())
             ON CONFLICT (type, slug) DO UPDATE SET parent_id=EXCLUDED.parent_id, nom=EXCLUDED.nom, categories=EXCLUDED.categories, visible=EXCLUDED.visible,
               ordre=EXCLUDED.ordre, images=EXCLUDED.images, donnees=EXCLUDED.donnees, date_maj=now()
             RETURNING id`,
            [l.type, l.slug, parent ?? null, l.nom, JSON.stringify(l.categories), l.visible, l.ordre, JSON.stringify(l.images), JSON.stringify(l.donnees)],
        );
        idParSlug.set(`${l.type}|${l.slug}`, rows[0].id);
    }
    await db.end();
    console.log(`${lignes.length} fiches enregistrées en base`);
})().catch((e) => { console.error(e); process.exit(1); });
