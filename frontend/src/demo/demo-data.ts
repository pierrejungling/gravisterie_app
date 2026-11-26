// Données FICTIVES de la démonstration. Aucune information réelle.
const JOUR = 86400000;
const iso = (decalage: number) => new Date(Date.now() + decalage * JOUR).toISOString();
let seq = 1;
export const uid = () => 'DEMO' + String(seq++).padStart(6, '0') + Math.random().toString(36).slice(2, 8).toUpperCase();

const client = (id: string, prenom: string, nom: string, societe: string | null, tel: string, mail: string | null) => ({
  id_client: id, nom, 'prénom': prenom, 'société': societe, mail, 'téléphone': tel, adresse: null, tva: null, notes: null,
});

export const CLIENTS = [
  client('CL-1', 'Camille', 'Durand', null, '0470 12 34 56', 'camille.durand@exemple.be'),
  client('CL-2', 'Lucas', 'Martin', 'Brasserie du Pont', '0471 23 45 67', 'contact@brasserie-exemple.be'),
  client('CL-3', 'Emma', 'Lambert', null, '0472 34 56 78', null),
  client('CL-4', 'Noah', 'Peeters', 'Studio Pixel', '0473 45 67 89', 'noah@studio-exemple.be'),
  client('CL-5', 'Léa', 'Dubois', null, '0474 56 78 90', 'lea.dubois@exemple.be'),
  client('CL-6', 'Hugo', 'Janssens', 'Café des Arts', '0475 67 89 01', null),
  client('CL-7', 'Chloé', 'Maes', null, '0476 78 90 12', 'chloe.maes@exemple.be'),
  client('CL-8', 'Tom', 'Willems', 'Atelier Willems', '0477 89 01 23', 'tom@atelier-exemple.be'),
];

type L = { nom: string; q: number; pu: number };
const cmd = (n: number, produit: string, description: string, cli: number, statut: string, lignes: L[], opt: any = {}) => {
  const total = lignes.reduce((s, l) => s + l.q * l.pu, 0) + (opt.remise || 0);
  const qte = lignes.reduce((s, l) => s + l.q, 0);
  const lignes_prix = lignes.map((l, i) => ({
    id: `LP-${n}-${i}`, remise: false, remise_pourcentage: false, nom: l.nom, quantite: l.q, prix_unitaire: l.pu, prix_final: l.q * l.pu,
  }));
  const supports = lignes.map((l, i) => ({
    id_commande_support: `CS-${n}-${i}`, nom_support: opt.support || 'Okoumé 4 mm', prix_support: String(opt.coutSupport ?? 2),
    url_support: null, prix_unitaire: true, nombre_unites: 1, prix_support_unitaire: String(opt.coutSupport ?? 2), actif: true, id_ligne_prix: `LP-${n}-${i}`,
  }));
  return {
    id_commande: `CMD-${n}`, date_commande: iso(-(opt.age ?? 3)), deadline: opt.deadline != null ? iso(opt.deadline) : null,
    produit, description, fichiers_joints: null, 'CGV_acceptée': true, 'newsletter_acceptée': false, statut_commande: statut,
    statuts_actifs: null, prix_final: String(total), prix_unitaire_final: String(qte ? total / qte : 0),
    frais_pourcentage: null, frais_commission_id: null, frais_commission_libelle: null,
    'quantité': qte, quantite_realisee: opt.realisee ?? 0, quantite_produit_compteurs: opt.compteurs ?? null,
    'payé': !!opt.paye, commentaire_paye: null, attente_reponse: !!opt.attente, mode_contact: opt.contact || 'mail',
    source_web: !!opt.web, site_traitee: false, id_evenement: opt.evenement ?? null,
    client: CLIENTS[cli], lignes_prix, supports,
    support: { nom_support: opt.support || 'Okoumé 4 mm', prix_support: null, url_support: null, dimensions: opt.dim || '10 x 10 cm' },
    personnalisation: { texte: opt.texte || '', police: opt.police || null, couleur: null },
    gravure: { dimensions: opt.dim || '10 x 10 cm' }, revision: 'demo',
  };
};

export const COMMANDES: any[] = [
  cmd(1, 'Planche à découper', '- Prénom + date\n- Bois clair', 0, 'en_attente_information', [{ nom: 'Planche', q: 1, pu: 38 }], { web: true, age: 1, attente: true, texte: 'Camille & Jules, 12.06.2027', police: 'Script' }),
  cmd(2, 'Verres gravés', '- Logo brasserie\n- 24 verres', 1, 'a_modeliser_preparer', [{ nom: 'Verre', q: 24, pu: 6.5 }], { age: 4, deadline: 12, support: 'Verre', coutSupport: 2.1 }),
  cmd(3, 'Porte-clés', '- Initiales\n- Cuir', 2, 'a_graver', [{ nom: 'Porte-clés', q: 12, pu: 7 }], { age: 6, deadline: 5, realisee: 4, support: 'Cuir', coutSupport: 1.4, compteurs: [{ id: 'a1', libelle: 'Porte-clés', quantite_cible: 12, quantite_realisee: 4 }] }),
  cmd(4, 'Enseigne atelier', '- Logo studio\n- 60 x 20 cm', 3, 'a_graver', [{ nom: 'Enseigne', q: 1, pu: 140 }], { age: 8, deadline: 3, support: 'Acrylique noir', coutSupport: 22, dim: '60 x 20 cm' }),
  cmd(5, 'Tampons gomme', '- 3 tailles', 4, 'a_graver', [{ nom: 'Tampon', q: 3, pu: 22 }], { age: 2, deadline: 7, support: 'Gomme', coutSupport: 4 }),
  cmd(6, 'Menus mariage', '- 80 menus\n- Peinture or', 5, 'a_finir_laver_assembler_peindre', [{ nom: 'Menu', q: 80, pu: 3.5 }], { age: 14, deadline: 9, realisee: 80, attente: false, paye: false, support: 'Carton', coutSupport: 0.4 }),
  cmd(7, 'Boule de Noël', '- Prénoms\n- Relief', 6, 'a_prendre_en_photo', [{ nom: 'Boule', q: 6, pu: 12 }], { age: 10, realisee: 6, paye: true, evenement: 'EV-1', support: 'Bois clair', coutSupport: 1.2 }),
  cmd(8, 'Plaque de porte', '- Cabinet\n- Inox brossé', 7, 'a_livrer', [{ nom: 'Plaque', q: 1, pu: 95 }], { age: 12, realisee: 1, paye: true, support: 'Inox', coutSupport: 28 }),
  cmd(9, 'Planches apéro', '- 10 planches\n- Logo café', 5, 'a_facturer', [{ nom: 'Planche', q: 10, pu: 32 }], { age: 20, realisee: 10, support: 'Chêne', coutSupport: 9 }),
  cmd(10, 'Magnets', '- Paysage Spa', 1, 'demande_avis', [{ nom: 'Magnet', q: 30, pu: 4.2 }], { age: 25, realisee: 30, paye: true, evenement: 'EV-1', coutSupport: 0.5 }),
  cmd(11, 'Cadre photo', '- Dédicace', 2, 'termine', [{ nom: 'Cadre', q: 1, pu: 48 }], { age: 40, realisee: 1, paye: true }),
  cmd(12, 'Ardoises de table', '- Numéros 1 à 20', 3, 'termine', [{ nom: 'Ardoise', q: 20, pu: 5 }], { age: 55, realisee: 20, paye: true, support: 'Ardoise', coutSupport: 1.8 }),
  cmd(14, 'Porte-clés', '- Initiales', 0, 'termine', [{ nom: 'Porte-clés', q: 8, pu: 7 }], { age: 9, realisee: 8, paye: true, support: 'Cuir', coutSupport: 1.4 }),
  cmd(15, 'Bougies gravées', '- Logo boutique', 4, 'termine', [{ nom: 'Bougie', q: 24, pu: 9 }], { age: 17, realisee: 24, paye: true, coutSupport: 3 }),
  cmd(16, 'Plaque bureau', '- Nom + fonction', 7, 'termine', [{ nom: 'Plaque', q: 2, pu: 34 }], { age: 22, realisee: 2, paye: true, support: 'Acrylique noir', coutSupport: 6 }),
  cmd(17, 'Planche à découper', '- Prénoms', 1, 'termine', [{ nom: 'Planche', q: 1, pu: 38 }], { age: 33, realisee: 1, paye: true }),
  cmd(18, 'Bouchons gravés', '- 50 bouchons', 5, 'termine', [{ nom: 'Bouchon', q: 50, pu: 2.4 }], { age: 47, realisee: 50, paye: true, support: 'Liège', coutSupport: 0.3 }),
  cmd(19, 'Menus restaurant', '- 40 menus', 3, 'termine', [{ nom: 'Menu', q: 40, pu: 3.8 }], { age: 62, realisee: 40, paye: true, support: 'Carton', coutSupport: 0.4 }),
  cmd(20, 'Trophées', '- 3 trophées', 6, 'termine', [{ nom: 'Trophée', q: 3, pu: 45 }], { age: 78, realisee: 3, paye: true, support: 'Chêne', coutSupport: 9 }),
  cmd(21, 'Magnets', '- Logo club', 2, 'termine', [{ nom: 'Magnet', q: 40, pu: 3.6 }], { age: 95, realisee: 40, paye: true, coutSupport: 0.5 }),
  cmd(13, 'Coffret cadeau', '- Annulé par le client', 6, 'annulee', [{ nom: 'Coffret', q: 1, pu: 60 }], { age: 30 }),
];

export const EVENEMENTS: any[] = [
  { id_evenement: 'EV-1', nom: 'Marché de Noël de Spa', type: 'marche', statut: 'confirme', date_debut: iso(12), date_fin: iso(13), heure_arrivee: null, lieu: 'Place Royale, Spa', adresse: 'Place Royale, 4900 Spa', contact_nom: 'Office du tourisme', contact_telephone: '0470 00 00 01', contact_mail: 'marche@exemple.be', id_client: 'CL-2', formule: 'stand', prix_forfait: 120, prix_gravure: 0, nb_gravures: 0, heures_sur_place: 16, heures_trajet: 1, forfait_carburant: 20, paye: false, materiel: [{ fait: true, texte: 'Graveuse portable + câble' }, { fait: false, texte: 'Rallonge / multiprise' }, { fait: false, texte: 'Présentoir' }], notes: 'Arrivée la veille pour monter le stand.', id_commande_prestation: null, caisse: null, date_creation: iso(-20), client: { id_client: 'CL-2', nom: 'Martin', 'prénom': 'Lucas', 'société': 'Brasserie du Pont' }, stats: { nb_commandes: 2, ca_commandes: 198, prestation: 320, prestation_calculee: 320, prestation_via_vente: false, prestation_payee: false, total: 518 } },
  { id_evenement: 'EV-2', nom: 'Mariage Dubois', type: 'mariage', statut: 'confirme', date_debut: iso(40), date_fin: iso(40), heure_arrivee: '14:00', lieu: 'Château de Jehay', adresse: 'Amay', contact_nom: 'Léa Dubois', contact_telephone: '0474 56 78 90', contact_mail: 'lea.dubois@exemple.be', id_client: 'CL-5', formule: 'gravure-live', prix_forfait: 450, prix_gravure: 8, nb_gravures: 60, heures_sur_place: 5, heures_trajet: 1, forfait_carburant: 30, paye: false, materiel: [{ fait: false, texte: 'Graveuse portable + câble' }], notes: '', id_commande_prestation: null, caisse: null, date_creation: iso(-45), client: { id_client: 'CL-5', nom: 'Dubois', 'prénom': 'Léa', 'société': '' }, stats: { nb_commandes: 0, ca_commandes: 0, prestation: 450, prestation_calculee: 450, prestation_via_vente: false, prestation_payee: false, total: 450 } },
];

export const BONS: any[] = [
  { id_bon: 'BON-1', numero: '2026-001', intitule: 'Bon cadeau 50 €', date_creation: iso(-30), nom: 'Janssens', prenom: 'Hugo', duree_validite: '12', date_echeance: iso(335), utilise: false, date_utilisation: null, valeur: '50' },
  { id_bon: 'BON-2', numero: '2026-002', intitule: 'Bon cadeau 25 €', date_creation: iso(-60), nom: 'Maes', prenom: 'Chloé', duree_validite: '12', date_echeance: iso(305), utilise: true, date_utilisation: iso(-10), valeur: '25' },
];

export const FRAIS = [
  { id_frais_commission: 'FC-1', libelle: 'Dépôt-vente (30 %)', pourcentage: '30' },
  { id_frais_commission: 'FC-2', libelle: 'Terminal de paiement (1,9 %)', pourcentage: '1.9' },
];

const tuile = (txt: string, c1: string, c2: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="215" font-family="Georgia,serif" font-size="34" fill="rgba(255,255,255,.9)" text-anchor="middle">${txt}</text></svg>`);
const site = (i: number, type: string, nom: string, cats: string[], prix: string, mat: string, dim: string, desc: string, c1: string, c2: string, client = '') => ({
  id: 'SI-' + i, type, slug: nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), nom, categories: cats,
  visible: i % 7 !== 0, ordre: i, images: ['a.jpg', 'b.jpg'], imagesUrl: [tuile(nom, c1, c2), tuile('détail', c2, c1)], nbEnfants: 0,
  donnees: { price: prix, material: mat, dimensions: dim, description: desc, keywords: ['bois', 'gravure', 'laser'], features: ['Découpé au laser', 'Fait main'], inStock: true, customizable: true, client },
  date_maj: new Date(Date.now() - i * 86400000).toISOString(),
});
export const SITE_ITEMS: any[] = [
  site(1, 'produit', 'Cerf géométrique', ['animaux'], '25 €', 'Okoumé 4 mm', '30 x 25 cm', 'Silhouette de cerf en bois découpé, à poser ou à suspendre.', '#7a5a3a', '#c9a36b'),
  site(2, 'produit', 'Cadre ville', ['deco-murale'], '30 €', 'Okoumé 4 mm', '20 x 20 cm', 'Carte gravée de la ville de ton choix.', '#3f5b4b', '#8fb39a'),
  site(3, 'produit', 'Boule de Noël', ['events'], 'À partir de 7 €', 'Bois clair', '8 cm', 'Boule personnalisable avec prénoms et relief.', '#8a3b34', '#d68a7e'),
  site(4, 'produit', 'Ardoise apéritive', ['accessoires'], '35 €', 'Ardoise', '30 x 20 cm', 'Ardoise gravée pour servir l’apéritif.', '#3b4552', '#8795a8'),
  site(5, 'produit', 'Lampe spirale', ['light'], 'Dès 70 €', 'Okoumé 4 mm', '35 cm', 'Lampe à latte en spirale, assemblage sans colle.', '#6a4a2a', '#e0b26a'),
  site(6, 'produit', 'Porte-clés cœur', ['accessoires', 'events'], '8 €', 'Cuir', '5 cm', 'Porte-clés avec initiales.', '#5a3b3b', '#b77a7a'),
  site(7, 'produit', 'Lotus mandala', ['deco-murale', 'vegetaux'], '45 €', 'Okoumé 4 mm', '40 cm', 'Mandala lotus en bois découpé.', '#4b3b5a', '#a78fc2'),
  site(8, 'projet', 'Menus de mariage', ['evenements'], '', 'Carton', 'A5', 'Menus gravés pour un mariage de 80 invités.', '#5a4a3b', '#c2a98f', 'Famille Dubois'),
  site(9, 'projet', 'Enseigne atelier', ['entreprises'], '', 'Acrylique noir', '60 x 20 cm', 'Enseigne pour un studio de création.', '#222', '#666', 'Studio Pixel'),
  site(10, 'projet', 'Verres de brasserie', ['entreprises'], '', 'Verre', '24 pièces', 'Logo gravé sur 24 verres.', '#35566b', '#8fb8d1', 'Brasserie du Pont'),
  site(11, 'projet', 'Planches apéro', ['accessoires'], '', 'Chêne', '10 pièces', 'Planches gravées pour un café.', '#6b5535', '#d1b88f', 'Café des Arts'),
];
