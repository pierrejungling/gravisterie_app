/**
 * Fond topographique vivant : des courbes de niveau tracées dans un canvas
 * plein écran, calculées sur un relief qui se déforme lentement (bruit 3D,
 * la 3e dimension est le temps). Les lignes ondulent et se recomposent sur
 * place, elles ne glissent pas.
 *
 * - une trentaine d'images par seconde au maximum, en pause quand l'onglet est caché
 * - image fixe si l'appareil demande moins d'animations
 * - couleurs reprises du thème (jour / nuit)
 */

const CELLULE = 14; // taille d'une case du relief, en px écran
const ECHELLE = 0.0021; // zoom du relief (plus petit = formes plus larges)
const VITESSE = 0.000035; // vitesse de déformation
const NIVEAUX = 26; // nombre de courbes de niveau
const IMAGE_MS = 33;

// --- Bruit de gradient 3D (Perlin) ---
const perm = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let graine = 20260911;
  for (let i = 255; i > 0; i--) {
    graine = (graine * 1664525 + 1013904223) >>> 0;
    const j = graine % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();

const lisse = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function grad(h: number, x: number, y: number, z: number): number {
  const k = h & 15;
  const u = k < 8 ? x : y;
  const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
  return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
}

function bruit(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const X = xi & 255, Y = yi & 255, Z = zi & 255;
  x -= xi; y -= yi; z -= zi;
  const u = lisse(x), v = lisse(y), w = lisse(z);
  const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
  return mix(
    mix(
      mix(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      mix(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
      v,
    ),
    mix(
      mix(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
      mix(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

/** Relief en un point : deux octaves, valeur ramenée à peu près entre 0 et NIVEAUX. */
function relief(x: number, y: number, t: number): number {
  const n = bruit(x * ECHELLE, y * ECHELLE, t) + 0.45 * bruit(x * ECHELLE * 2.3 + 40, y * ECHELLE * 2.3 + 17, t * 1.6 + 9);
  return (n * 0.62 + 0.5) * NIVEAUX;
}

let demarre = false;

export function demarrerFondTopo(): void {
  if (demarre || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  demarre = true;

  canvas.className = 'gv-topo-fond';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  let largeur = 0, hauteur = 0, colonnes = 0, lignes = 0;
  let champ = new Float32Array(0);
  let couleur = '#161412';
  let opacite = 0.1;

  const lireTheme = () => {
    const nuit = document.documentElement.getAttribute('data-theme') === 'dark';
    couleur = nuit ? '#ff5a3c' : '#161412';
    opacite = nuit ? 0.13 : 0.11;
  };

  const dimensionner = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    largeur = window.innerWidth;
    hauteur = window.innerHeight;
    canvas.width = Math.round(largeur * dpr);
    canvas.height = Math.round(hauteur * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colonnes = Math.ceil(largeur / CELLULE) + 1;
    lignes = Math.ceil(hauteur / CELLULE) + 1;
    champ = new Float32Array(colonnes * lignes);
  };

  const dessiner = (t: number) => {
    for (let j = 0; j < lignes; j++) {
      for (let i = 0; i < colonnes; i++) {
        champ[j * colonnes + i] = relief(i * CELLULE, j * CELLULE, t);
      }
    }

    ctx.clearRect(0, 0, largeur, hauteur);
    ctx.strokeStyle = couleur;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const fin = new Path2D(); // courbes ordinaires
    const fort = new Path2D(); // une courbe maîtresse toutes les 5

    for (let j = 0; j < lignes - 1; j++) {
      const y0 = j * CELLULE, y1 = y0 + CELLULE;
      for (let i = 0; i < colonnes - 1; i++) {
        const a = champ[j * colonnes + i]; // haut gauche
        const b = champ[j * colonnes + i + 1]; // haut droite
        const c = champ[(j + 1) * colonnes + i + 1]; // bas droite
        const d = champ[(j + 1) * colonnes + i]; // bas gauche
        const mini = Math.min(a, b, c, d), maxi = Math.max(a, b, c, d);
        const x0 = i * CELLULE, x1 = x0 + CELLULE;

        for (let n = Math.ceil(mini); n <= maxi; n++) {
          if (n === mini) continue;
          const chemin = n % 5 === 0 ? fort : fin;
          // Points de passage de la courbe n sur les 4 côtés de la case
          const pts: number[] = [];
          if ((a < n) !== (b < n)) pts.push(x0 + ((n - a) / (b - a)) * CELLULE, y0);
          if ((b < n) !== (c < n)) pts.push(x1, y0 + ((n - b) / (c - b)) * CELLULE);
          if ((d < n) !== (c < n)) pts.push(x0 + ((n - d) / (c - d)) * CELLULE, y1);
          if ((a < n) !== (d < n)) pts.push(x0, y0 + ((n - a) / (d - a)) * CELLULE);
          if (pts.length === 4) {
            chemin.moveTo(pts[0], pts[1]);
            chemin.lineTo(pts[2], pts[3]);
          } else if (pts.length === 8) {
            // Col : on relie selon la hauteur au centre de la case
            const centreHaut = (a + b + c + d) / 4 >= n;
            if ((a >= n) === centreHaut) {
              chemin.moveTo(pts[0], pts[1]); chemin.lineTo(pts[2], pts[3]);
              chemin.moveTo(pts[4], pts[5]); chemin.lineTo(pts[6], pts[7]);
            } else {
              chemin.moveTo(pts[0], pts[1]); chemin.lineTo(pts[6], pts[7]);
              chemin.moveTo(pts[2], pts[3]); chemin.lineTo(pts[4], pts[5]);
            }
          }
        }
      }
    }

    ctx.globalAlpha = opacite;
    ctx.lineWidth = 1;
    ctx.stroke(fin);
    ctx.globalAlpha = opacite * 1.7;
    ctx.lineWidth = 1.4;
    ctx.stroke(fort);
    ctx.globalAlpha = 1;
  };

  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  let derniere = 0;
  let temps = 3.7;
  let boucle = 0;

  const image = (maintenant: number) => {
    boucle = requestAnimationFrame(image);
    const ecart = maintenant - derniere;
    if (ecart < IMAGE_MS) return;
    derniere = maintenant;
    temps += Math.min(ecart, 100) * VITESSE;
    dessiner(temps);
  };

  const relancer = () => {
    cancelAnimationFrame(boucle);
    if (document.hidden) return;
    if (reduit.matches) {
      dessiner(temps);
    } else {
      derniere = 0;
      boucle = requestAnimationFrame(image);
    }
  };

  lireTheme();
  dimensionner();
  relancer();

  window.addEventListener('resize', () => { dimensionner(); dessiner(temps); });
  document.addEventListener('visibilitychange', relancer);
  reduit.addEventListener?.('change', relancer);
  new MutationObserver(() => { lireTheme(); dessiner(temps); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
