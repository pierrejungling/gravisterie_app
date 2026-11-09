import { Injectable, signal, effect, EffectRef } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  theme = signal<Theme>(this.getTheme());
  private readonly themeChangeHandler: EffectRef = effect(() => this.handleThemeChange(this.theme()));

  constructor() {
    // Initialiser le thème au chargement
    this.applyTheme(this.theme());
    this.updateThemeColor(this.theme());
  }

  toggleTheme(): void {
    const newTheme: Theme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(newTheme);
  }

  private handleThemeChange(theme: Theme): void {
    localStorage.setItem(this.THEME_KEY, theme);
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

  private getTheme(): Theme {
    const stored = localStorage.getItem(this.THEME_KEY);
    return (stored === 'dark' || stored === 'light') ? stored : 'light';
  }

  isDarkMode(): boolean {
    return this.theme() === 'dark';
  }
}
