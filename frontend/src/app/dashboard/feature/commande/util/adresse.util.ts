/**
 * Nettoie une adresse « rue, code postal, ville, pays ».
 * Corrige les anciennes données du type « Belgique, Belgique, Belgique » :
 * le pays seul était relu comme une rue puis ré-enregistré à chaque modification.
 */
export function nettoyerAdresse(adresse: string | null | undefined): string {
  const parts = (adresse || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.every((p) => p.toLowerCase() === 'belgique')) return 'Belgique';
  return parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase()).join(', ');
}

/** Vrai si l'adresse contient autre chose que le pays. */
export function adresseUtile(adresse: string | null | undefined): string | null {
  const propre = nettoyerAdresse(adresse);
  return propre && propre.toLowerCase() !== 'belgique' ? propre : null;
}
