import { createHash } from 'crypto';

/**
 * Forme stable d'une valeur : clés triées, dates en ISO, listes d'objets triées
 * (l'ordre des lignes renvoyé par la base n'est pas garanti).
 */
function canonique(valeur: unknown): unknown {
    if (valeur === undefined || valeur === null) return null;
    if (valeur instanceof Date) return valeur.toISOString();
    if (Array.isArray(valeur)) {
        const items = valeur.map(canonique);
        const objets = items.every((i) => i !== null && typeof i === 'object');
        return objets ? items.map((i) => JSON.stringify(i)).sort() : items;
    }
    if (typeof valeur === 'object') {
        const source = valeur as Record<string, unknown>;
        const sortie: Record<string, unknown> = {};
        for (const cle of Object.keys(source).sort()) {
            sortie[cle] = canonique(source[cle]);
        }
        return sortie;
    }
    return valeur;
}

/**
 * Empreinte du contenu d'une commande. Elle change dès qu'une donnée de la commande change,
 * peu importe qui l'a modifiée (app, API, formulaire du site). Sert à refuser un enregistrement
 * fait à partir d'une version périmée.
 */
export function empreinteCommande(commande: unknown): string {
    return createHash('sha1').update(JSON.stringify(canonique(commande))).digest('hex').slice(0, 16);
}
