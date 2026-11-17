"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.empreinteCommande = empreinteCommande;
const crypto_1 = require("crypto");
function canonique(valeur) {
    if (valeur === undefined || valeur === null)
        return null;
    if (valeur instanceof Date)
        return valeur.toISOString();
    if (Array.isArray(valeur)) {
        const items = valeur.map(canonique);
        const objets = items.every((i) => i !== null && typeof i === 'object');
        return objets ? items.map((i) => JSON.stringify(i)).sort() : items;
    }
    if (typeof valeur === 'object') {
        const source = valeur;
        const sortie = {};
        for (const cle of Object.keys(source).sort()) {
            sortie[cle] = canonique(source[cle]);
        }
        return sortie;
    }
    return valeur;
}
function empreinteCommande(commande) {
    return (0, crypto_1.createHash)('sha1').update(JSON.stringify(canonique(commande))).digest('hex').slice(0, 16);
}
//# sourceMappingURL=empreinte.util.js.map