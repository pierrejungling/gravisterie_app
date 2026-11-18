import { Injectable, signal, effect, EffectRef } from '@angular/core';

export type Theme = 'light' | 'dark';

// Position par défaut : Spa (Belgique). Remplacée par la position réelle si le navigateur la donne.
const SPA = { latitude: 50.492, longitude: 5.864 };
const POSITION_KEY = 'position-soleil';
const POSITION_ESSAI_KEY = 'position-soleil-essai';
const POSITION_VALIDITE_MS = 6 * 3_600_000; // on redemande la position au plus toutes les 6 h
const ESSAI_REFUS_MS = 7 * 86_400_000; // si elle est refusée, on ne redemande pas avant 7 jours
const JOUR_MS = 86_400_000;
const RAD = Math.PI / 180;

export interface Position { latitude: number; longitude: number; }

/** Position utilisée pour le calcul du soleil (Spa tant que la vraie position n'est pas connue). */
let positionSoleil: Position = lirePositionMemorisee() ?? SPA;

function lirePositionMemorisee(): Position | null {
  try {
    const p = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
    if (p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) return { latitude: p.latitude, longitude: p.longitude };
  } catch {}
  return null;
}

/** Lever et coucher du soleil pour le jour (UTC) de la date donnée, à la position donnée, en ms. */
export function soleilA(date: Date, position: Position = positionSoleil): { lever: number; coucher: number } {
  const n = Math.floor(date.getTime() / JOUR_MS) + 2440588 - 2451545; // jours depuis J2000
  const j = n - position.longitude / 360;
  const m = ((357.5291 + 0.98560028 * j) % 360) * RAD;
  const c = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
  const lambda = ((m / RAD + c + 180 + 102.9372) % 360) * RAD;
  const midi = 2451545 + j + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda);
  const declinaison = Math.asin(Math.sin(lambda) * Math.sin(23.4397 * RAD));
  const cosAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(position.latitude * RAD) * Math.sin(declinaison)) /
    (Math.cos(position.latitude * RAD) * Math.cos(declinaison));
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) / RAD;
  const enMs = (jj: number) => (jj - 2440587.5) * JOUR_MS;
  return { lever: enMs(midi - angle / 360), coucher: enMs(midi + angle / 360) };
}

/**
 * Thème voulu par le soleil à cet instant, et moment du prochain lever ou coucher.
 * On regarde la veille, le jour et le lendemain (en UTC) pour rester juste quel que soit le fuseau.
 */
export function themeSolaire(maintenant = Date.now(), position: Position = positionSoleil): { theme: Theme; prochain: number } {
  const evenements: { t: number; lever: boolean }[] = [];
  for (const decalage of [-1, 0, 1, 2]) {
    const { lever, coucher } = soleilA(new Date(maintenant + decalage * JOUR_MS), position);
    evenements.push({ t: lever, lever: true }, { t: coucher, lever: false });
  }
  evenements.sort((a, b) => a.t - b.t);
  const passes = evenements.filter((e) => e.t <= maintenant);
  const dernier = passes[passes.length - 1];
  const suivant = evenements.find((e) => e.t > maintenant);
  return { theme: dernier?.lever ? 'light' : 'dark', prochain: suivant ? suivant.t : maintenant + JOUR_MS };
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  /** Choix manuel : { theme, jusqu } ; il tient jusqu'au prochain lever ou coucher du soleil. */
  private readonly MANUEL_KEY = 'theme-manuel';
  theme = signal<Theme>(this.getTheme());
  private readonly themeChangeHandler: EffectRef = effect(() => this.handleThemeChange(this.theme()));

  constructor() {
    // Initialiser le thème au chargement
    this.applyTheme(this.theme());
    this.updateThemeColor(this.theme());
    // Suivre le soleil : vérification chaque minute et au retour sur l'onglet
    setInterval(() => this.suivreSoleil(), 60_000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.suivreSoleil();
        this.localiser();
      }
    });
    this.localiser();
  }

  /**
   * Demande la position au navigateur (au plus toutes les 6 h) pour caler le lever / coucher du soleil
   * sur l'endroit où tu te trouves. Refusée ou indisponible : on garde la dernière position connue, sinon Spa.
   */
  private localiser(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    try {
      const memo = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
      if (memo && Date.now() - Number(memo.at) < POSITION_VALIDITE_MS) return;
      const refus = Number(localStorage.getItem(POSITION_ESSAI_KEY) || 0);
      if (refus && Date.now() - refus < ESSAI_REFUS_MS) return;
    } catch {}
    navigator.geolocation.getCurrentPosition(
      (p) => {
        positionSoleil = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        try {
          localStorage.setItem(POSITION_KEY, JSON.stringify({ ...positionSoleil, at: Date.now() }));
          localStorage.removeItem(POSITION_ESSAI_KEY);
        } catch {}
        this.suivreSoleil();
      },
      () => {
        try {
          localStorage.setItem(POSITION_ESSAI_KEY, String(Date.now()));
        } catch {}
      },
      { timeout: 10_000, maximumAge: 3_600_000, enableHighAccuracy: false },
    );
  }

  /** Bascule manuelle : garde la main jusqu'au prochain lever ou coucher du soleil. */
  toggleTheme(): void {
    const newTheme: Theme = this.theme() === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(this.MANUEL_KEY, JSON.stringify({ theme: newTheme, jusqu: themeSolaire().prochain }));
    } catch {}
    this.theme.set(newTheme);
  }

  private suivreSoleil(): void {
    const voulu = this.getTheme();
    if (voulu !== this.theme()) this.theme.set(voulu);
  }

  private handleThemeChange(theme: Theme): void {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch {}
    this.applyTheme(theme);
    this.updateThemeColor(theme);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private updateThemeColor(theme: Theme): void {
    const themeColor = theme === 'dark' ? '#0d0c0b' : '#f6f4f1';
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    
    metaThemeColor.setAttribute('content', themeColor);
  }

  /** Choix manuel encore valable, sinon le thème donné par le soleil à Spa. */
  private getTheme(): Theme {
    try {
      const manuel = JSON.parse(localStorage.getItem(this.MANUEL_KEY) || 'null');
      if (manuel && (manuel.theme === 'dark' || manuel.theme === 'light') && Date.now() < Number(manuel.jusqu)) {
        return manuel.theme;
      }
      if (manuel) localStorage.removeItem(this.MANUEL_KEY);
    } catch {}
    return themeSolaire().theme;
  }

  isDarkMode(): boolean {
    return this.theme() === 'dark';
  }
}
