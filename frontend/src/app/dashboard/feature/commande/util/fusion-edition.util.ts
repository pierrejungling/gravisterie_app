/**
 * Fusion des modifications en mode édition du détail commande.
 *
 * Le formulaire est découpé en « unités » (un champ, ou un petit groupe de champs qui vont ensemble).
 * Pour chaque unité on compare trois versions :
 * - la base  : ce que l'app avait chargé en entrant en modification (ou après la dernière fusion) ;
 * - la mienne : ce qui est dans le formulaire ;
 * - la reçue : ce que le serveur contient maintenant.
 * Unité changée d'un seul côté : on garde ce côté. Changée des deux côtés : conflit, à trancher.
 */

export interface UniteEdition {
  cle: string;
  label: string;
  /** Contrôles du formulaire qui composent l'unité. */
  controles: string[];
  /** L'unité est une liste (FormArray) : on la remplace d'un bloc. */
  liste?: boolean;
  /** Clés du contenu envoyé au serveur quand l'unité a été modifiée. */
  envoi: string[];
}

export interface ConflitEdition {
  cle: string;
  label: string;
  /** Ma version, en texte lisible. */
  mienne: string;
  /** La version reçue, en texte lisible. */
  recue: string;
}

const CONTACT = ['coordonnees_contact'];
const PRIX_LIES = ['lignes_prix', 'supports', 'prix_final', 'prix_unitaire_final', 'quantité'];

export const UNITES_EDITION: UniteEdition[] = [
  { cle: 'nom_commande', label: 'Intitulé', controles: ['nom_commande'], envoi: ['produit'] },
  { cle: 'date_commande', label: 'Date de commande', controles: ['date_commande'], envoi: ['date_commande'] },
  { cle: 'deadline', label: 'Deadline', controles: ['deadline'], envoi: ['deadline'] },
  { cle: 'description', label: 'Description', controles: ['description'], envoi: ['description'] },
  { cle: 'quantite', label: 'Quantité', controles: ['quantité'], envoi: ['quantité'] },
  { cle: 'prix', label: 'Prix final', controles: ['prix_final'], envoi: ['prix_final', 'prix_unitaire_final'] },
  { cle: 'lignes_prix', label: 'Lignes de prix', controles: ['lignes_prix'], liste: true, envoi: PRIX_LIES },
  { cle: 'supports', label: 'Frais et supports', controles: ['supports'], liste: true, envoi: ['lignes_prix', 'supports'] },
  {
    cle: 'frais',
    label: 'Frais de commission',
    controles: ['frais_commission_selection', 'frais_commission_id', 'frais_commission_libelle', 'frais_pourcentage'],
    envoi: ['frais_pourcentage', 'frais_commission_id', 'frais_commission_libelle'],
  },
  { cle: 'commentaire_paye', label: 'Commentaire de paiement', controles: ['commentaire_paye'], envoi: ['commentaire_paye'] },
  { cle: 'mode_contact', label: 'Mode de contact', controles: ['mode_contact'], envoi: ['mode_contact'] },
  {
    cle: 'compteurs',
    label: 'Compteurs',
    controles: ['quantite_produit_compteurs'],
    liste: true,
    envoi: ['quantite_produit_compteurs', 'quantite_realisee'],
  },
  { cle: 'texte', label: 'Texte de personnalisation', controles: ['texte_personnalisation'], envoi: ['personnalisation'] },
  { cle: 'police', label: 'Police', controles: ['police_ecriture'], envoi: ['personnalisation'] },
  { cle: 'couleur', label: 'Couleurs', controles: ['couleur'], envoi: ['personnalisation'] },
  { cle: 'dimensions', label: 'Dimensions', controles: ['dimensions'], envoi: ['gravure'] },
  { cle: 'support', label: 'Support', controles: ['support', 'prix_support', 'url_support'], envoi: ['support'] },
  { cle: 'nom', label: 'Nom', controles: ['nom'], envoi: CONTACT },
  { cle: 'prenom', label: 'Prénom', controles: ['prenom'], envoi: CONTACT },
  { cle: 'societe', label: 'Société', controles: ['societe'], envoi: CONTACT },
  { cle: 'telephone', label: 'Téléphone', controles: ['telephone'], envoi: CONTACT },
  { cle: 'mail', label: 'Mail', controles: ['mail'], envoi: CONTACT },
  { cle: 'adresse', label: 'Adresse', controles: ['rue', 'code_postal', 'ville', 'pays'], envoi: CONTACT },
  { cle: 'tva', label: 'TVA', controles: ['tva'], envoi: CONTACT },
];

/** Sur une commande (pas une vente), prix final et quantité se déduisent des lignes de prix. */
export const UNITES_DEDUITES_DES_LIGNES = ['prix', 'quantite'];

/** Contrôles enregistrés à chaque clic, hors mode modification : on reprend toujours la version reçue. */
export const CONTROLES_EN_DIRECT = ['payé', 'attente_reponse'];

type Brut = Record<string, any>;

/** Valeur ramenée à une forme comparable : vide = '', 12 = "12" = "12.00". */
function normaliser(valeur: any): any {
  if (valeur === null || valeur === undefined) return '';
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? String(valeur) : '';
  if (typeof valeur === 'string') {
    const texte = valeur.trim();
    return /^-?\d+([.,]\d+)?$/.test(texte) ? String(parseFloat(texte.replace(',', '.'))) : valeur;
  }
  if (Array.isArray(valeur)) return valeur.map(normaliser);
  if (typeof valeur === 'object') {
    const sortie: Brut = {};
    Object.keys(valeur)
      .sort()
      .forEach((cle) => (sortie[cle] = normaliser(valeur[cle])));
    return sortie;
  }
  return valeur;
}

/**
 * Valeur d'une liste sans ses identifiants techniques : une ligne sans identifiant en reçoit un au hasard
 * à chaque construction du formulaire, ce qui ferait croire à une modification.
 */
function valeurListe(unite: UniteEdition, brut: Brut): any {
  const liste: Brut[] = Array.isArray(brut[unite.controles[0]]) ? brut[unite.controles[0]] : [];
  if (unite.cle === 'lignes_prix' || unite.cle === 'compteurs') {
    return liste.map(({ id, ...reste }) => reste);
  }
  if (unite.cle === 'supports') {
    const ids: string[] = (Array.isArray(brut['lignes_prix']) ? brut['lignes_prix'] : []).map((l: Brut) => l?.['id']);
    return liste.map(({ id_ligne_prix, ...reste }) => ({ ...reste, ligne: ids.indexOf(id_ligne_prix) }));
  }
  return liste;
}

/** Photographie du formulaire : une valeur comparable par unité. */
export function instantaneUnites(brut: Brut): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const unite of UNITES_EDITION) {
    const valeur = unite.liste ? valeurListe(unite, brut) : unite.controles.map((nom) => brut[nom]);
    sortie[unite.cle] = JSON.stringify(normaliser(valeur));
  }
  return sortie;
}

/** Unités dont la valeur diffère entre deux photographies. */
export function unitesDifferentes(a: Record<string, string>, b: Record<string, string>): UniteEdition[] {
  return UNITES_EDITION.filter((unite) => a[unite.cle] !== b[unite.cle]);
}

function vide(valeur: any): boolean {
  return valeur === null || valeur === undefined || String(valeur).trim() === '';
}

function euros(valeur: any): string {
  return vide(valeur) ? '-' : `${String(valeur).replace('.', ',')} €`;
}

function dateLisible(valeur: any): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valeur ?? '');
}

/** Texte lisible d'une unité, pour le panneau de comparaison. */
export function texteUnite(unite: UniteEdition, brut: Brut): string {
  let texte = '';
  switch (unite.cle) {
    case 'lignes_prix':
      texte = (brut['lignes_prix'] ?? [])
        .map((l: Brut) => `${l['nom'] || (l['remise'] ? 'Remise' : 'Prix')} : ${vide(l['quantite']) ? '' : l['quantite'] + ' × '}${euros(l['prix_unitaire'])} = ${euros(l['prix_final'])}`)
        .join('\n');
      break;
    case 'supports':
      texte = (brut['supports'] ?? [])
        .filter((s: Brut) => !vide(s['nom_support']) || !vide(s['prix_support']) || !vide(s['url_support']))
        .map((s: Brut) => `${s['nom_support'] || 'Sans nom'} : ${euros(s['prix_support'])}${s['actif'] === false ? ' (non compté)' : ''}`)
        .join('\n');
      break;
    case 'compteurs':
      texte = (brut['quantite_produit_compteurs'] ?? [])
        .map((c: Brut) => `${c['libelle'] || 'Sans libellé'} : ${c['quantite_realisee'] ?? 0} / ${c['quantite_cible'] ?? 0}`)
        .join('\n');
      break;
    case 'date_commande':
    case 'deadline':
      texte = vide(brut[unite.controles[0]]) ? '' : dateLisible(brut[unite.controles[0]]);
      break;
    case 'prix':
      texte = vide(brut['prix_final']) ? '' : euros(brut['prix_final']);
      break;
    case 'frais':
      texte = [brut['frais_commission_libelle'], vide(brut['frais_pourcentage']) ? '' : `${brut['frais_pourcentage']} %`]
        .filter((v) => !vide(v))
        .join(' · ');
      break;
    case 'couleur':
      texte = Array.isArray(brut['couleur']) ? brut['couleur'].join(', ') : '';
      break;
    case 'support':
      texte = [brut['support'], vide(brut['prix_support']) ? '' : euros(brut['prix_support']), brut['url_support']]
        .filter((v) => !vide(v))
        .join(' · ');
      break;
    case 'adresse':
      texte = [brut['rue'], [brut['code_postal'], brut['ville']].filter((v) => !vide(v)).join(' '), brut['pays']]
        .filter((v) => !vide(v))
        .join(', ');
      break;
    default:
      texte = unite.controles
        .map((nom) => brut[nom])
        .filter((v) => !vide(v))
        .join(' ');
  }
  return texte.trim() || '(vide)';
}

/** Clés du contenu à envoyer : uniquement celles des unités modifiées. */
export function clesAEnvoyer(unites: UniteEdition[]): Set<string> {
  const cles = new Set<string>();
  unites.forEach((unite) => unite.envoi.forEach((cle) => cles.add(cle)));
  return cles;
}
