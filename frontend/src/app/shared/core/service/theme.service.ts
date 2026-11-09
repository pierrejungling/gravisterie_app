import { Injectable, signal, effect, EffectRef } from '@angular/core';

export type Theme = 'light' | 'dark';

// Spa (Belgique) : sert au passage automatique jour / nuit
const LATITUDE = 50.492;
const LONGITUDE = 5.864;
const JOUR_MS = 86_400_000;
const RAD = Math.PI / 180;

/** Lever et coucher du soleil à Spa pour le jour (UTC) de la date donnée, en ms. */
export function soleilASpa(date: Date): { lever: number; coucher: number } {
  const n = Math.floor(date.getTime() / JOUR_MS) + 2440588 - 2451545; // jours depuis J2000
  const j = n - LONGITUDE / 360;
  const m = ((357.5291 + 0.98560028 * j) % 360) * RAD;
  const c = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m);
  const lambda = ((m / RAD + c + 180 + 102.9372) % 360) * RAD;
  const midi = 2451545 + j + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda);
  const declinaison = Math.asin(Math.sin(lambda) * Math.sin(23.4397 * RAD));
  const cosAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(LATITUDE * RAD) * Math.sin(declinaison)) /
    (Math.cos(LATITUDE * RAD) * Math.cos(declinaison));
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) / RAD;
  const enMs = (jj: number) => (jj - 2440587.5) * JOUR_MS;
  return { lever: enMs(midi - angle / 360), coucher: enMs(midi + angle / 360) };
}

/** Thème voulu par le soleil à cet instant, et moment du prochain lever ou coucher. */
export function themeSolaire(maintenant = Date.now()): { theme: Theme; prochain: number } {
  const { lever, coucher } = soleilASpa(new Date(maintenant));
  if (maintenant < lever) return { theme: 'dark', prochain: lever };
  if (maintenant < coucher) return { theme: 'light', prochain: coucher };
  return { theme: 'dark', prochain: soleilASpa(new Date(maintenant + JOUR_MS)).lever };
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
      if (!document.hidden) this.suivreSoleil();
    });
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
