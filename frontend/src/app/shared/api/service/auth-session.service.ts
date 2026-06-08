import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { finalize, map, shareReplay } from 'rxjs/operators';
import { AppNode } from '@shared';
import { ApiURI } from '../enum';
import { ApiResponse, Token } from '../model';
import { ApiService } from './api.service';
import { TokenService } from './token.service';

const LAST_ROUTE_KEY = 'auth-last-route';
const RETURN_URL_KEY = 'auth-return-url';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class AuthSessionService {
  private readonly tokenService = inject(TokenService);
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private refreshInFlight: Observable<Token> | null = null;

  isAuthenticated(): boolean {
    const token = this.tokenService.token();
    return !token.isEmpty && token.token.trim().length > 0;
  }

  persistCurrentRoute(url?: string): void {
    const route = this.normalizeRoute(url ?? this.router.url);
    if (!this.isPersistableRoute(route)) {
      return;
    }
    try {
      localStorage.setItem(LAST_ROUTE_KEY, route);
    } catch {
      // ignorer si localStorage indisponible
    }
  }

  saveReturnUrl(url?: string): void {
    const route = this.normalizeRoute(url ?? this.router.url);
    if (!this.isPersistableRoute(route)) {
      return;
    }
    try {
      localStorage.setItem(RETURN_URL_KEY, route);
    } catch {
      // ignorer si localStorage indisponible
    }
  }

  consumeReturnUrl(): string | null {
    try {
      const saved = localStorage.getItem(RETURN_URL_KEY) ?? localStorage.getItem(LAST_ROUTE_KEY);
      localStorage.removeItem(RETURN_URL_KEY);
      if (saved && this.isPersistableRoute(saved)) {
        return saved;
      }
    } catch {
      // ignorer
    }
    return null;
  }

  clearPersistedRoutes(): void {
    try {
      localStorage.removeItem(RETURN_URL_KEY);
      localStorage.removeItem(LAST_ROUTE_KEY);
    } catch {
      // ignorer
    }
  }

  refreshAccessTokenIfNeeded(force = false): Observable<Token | null> {
    if (!this.isAuthenticated()) {
      return of(null);
    }
    if (!force && !this.isAccessTokenExpiringSoon()) {
      return of(null);
    }
    return this.refreshAccessToken();
  }

  refreshAccessToken(): Observable<Token> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = this.tokenService.token().refreshToken;
    if (!refreshToken?.trim()) {
      return throwError(() => new Error('Missing refresh token'));
    }

    this.refreshInFlight = this.apiService.post(ApiURI.REFRESH_TOKEN, { refresh: refreshToken }).pipe(
      map((result: ApiResponse) => {
        if (!result.result || !result.data) {
          throw new Error('Refresh failed');
        }
        const newToken: Token = {
          ...(result.data as Token),
          isEmpty: false,
        };
        this.tokenService.setToken(newToken);
        return newToken;
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay(1)
    );

    return this.refreshInFlight;
  }

  onAppVisible(): void {
    if (!this.isAuthenticated() || !this.isAccessTokenExpiringSoon()) {
      return;
    }

    this.refreshAccessToken().subscribe({
      error: () => {
        // La déconnexion sera gérée à la prochaine requête API protégée.
      }
    });
  }

  redirectToSignIn(returnUrl?: string): void {
    this.saveReturnUrl(returnUrl);
    this.tokenService.setToken({ token: '', refreshToken: '', isEmpty: true });
    this.router.navigate([AppNode.REDIRECT_TO_PUBLIC]).then();
  }

  private normalizeRoute(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  private isPersistableRoute(route: string): boolean {
    if (!route.startsWith(`/${AppNode.AUTHENTICATED}`)) {
      return false;
    }
    return route !== `/${AppNode.AUTHENTICATED}` && route !== `/${AppNode.AUTHENTICATED}/`;
  }

  private isAccessTokenExpiringSoon(): boolean {
    const exp = this.getAccessTokenExpirationMs();
    if (exp === null) {
      return true;
    }
    return Date.now() >= exp - EXPIRY_BUFFER_MS;
  }

  private getAccessTokenExpirationMs(): number | null {
    const token = this.tokenService.token().token;
    if (!token) {
      return null;
    }
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) {
        return null;
      }
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      const payload = JSON.parse(atob(padded)) as { exp?: number };
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }
}
