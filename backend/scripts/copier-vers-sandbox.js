/**
 * Copie les photos du bucket de production vers le bucket de test (sandbox), puis publie les données locales dessus :
 *   R2_SITE_BUCKET_NAME=gravisterie-site-dev R2_SITE_PUBLIC_URL=<adresse publique du bucket de test> node scripts/copier-vers-sandbox.js
 * Lit les clés d'images dans la base locale ; ne touche jamais au bucket de production (lecture publique seulement).
 */
require('dotenv').config();
const fs = require('fs'), os = require('os'), path = require('path');
const { Client } = require('pg');
const SOURCE = process.env.SOURCE_PUBLIC_URL || 'https://pub-44790f148af74cc1b8dd3dc1ab4b3038.r2.dev';
const BUCKET = process.env.R2_SITE_BUCKET_NAME;
const ACCOUNT = process.env.R2_ACCOUNT_ID || '58dcd0759eea7dc927400d57d4ba07b7';
if (!BUCKET || BUCKET === 'gravisterie-site') throw new Error('Indiquer un bucket de test (jamais gravisterie-site)');

const jeton = () => fs.readFileSync(path.join(os.homedir(), 'Library/Preferences/.wrangler/config/default.toml'), 'utf8').match(/oauth_token\s*=\s*"([^"]+)"/)[1];
const cles = new Set();
const collecter = (v) => {
    if (typeof v === 'string') { if (v.startsWith('img/')) cles.add(v); }
    else if (Array.isArray(v)) v.forEach(collecter);
    else if (v && typeof v === 'object') Object.values(v).forEach(collecter);
};

(async () => {
    const db = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_DATABASE });
    await db.connect();
    const { rows } = await db.query('SELECT images, donnees FROM site_item');
    await db.end();
    rows.forEach((r) => { collecter(r.images); collecter(r.donnees); });
    const liste = [...cles].flatMap((k) => [k, k.replace(/\.webp$/, '-sm.webp')]);
    console.log(`${liste.length} fichiers à copier vers ${BUCKET}`);
    let fait = 0, echecs = 0;
    const travailleur = async () => {
        while (liste.length) {
            const cle = liste.pop();
            try {
                const r = await fetch(`${SOURCE}/${cle}`);
                if (!r.ok) throw new Error(`lecture ${r.status}`);
                const corps = Buffer.from(await r.arrayBuffer());
                const w = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects/${cle.split('/').map(encodeURIComponent).join('/')}`, {
                    method: 'PUT', headers: { Authorization: `Bearer ${jeton()}`, 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' }, body: corps });
                if (!w.ok) throw new Error(`écriture ${w.status}`);
                if (++fait % 200 === 0) console.log(`  ${fait} copiés`);
            } catch (e) { echecs++; console.warn(cle, e.message); }
        }
    };
    await Promise.all(Array.from({ length: 8 }, travailleur));
    console.log(`Copie terminée : ${fait} fichiers, ${echecs} échecs`);
})().catch((e) => { console.error(e); process.exit(1); });
