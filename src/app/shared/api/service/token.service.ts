import { Injectable, inject, WritableSignal, signal, effect, EffectRef } from '@angular/core';
import { environment } from '../../../../environment/environment';
import { Token } from '../model';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  token: WritableSignal<Token> = signal(this.getToken());
  private readonly tokenSaveHandler: EffectRef = effect(() => this.handleTokenChange(this.token()));

  public setToken(token: Token): void {
    if (!token.isEmpty && token.token.trim().length > 0) {
      this.token.set({ ...token, isEmpty: false });
    } else {
      this.token.set(this.getEmpty());
      localStorage.removeItem(environment.TOKEN_KEY);
    }
  }

  private handleTokenChange(token: Token): void {
    if (!token.isEmpty) {
      localStorage.setItem(environment.TOKEN_KEY, JSON.stringify(token));
    } else {
      localStorage.removeItem(environment.TOKEN_KEY);
    }
  }

  private getToken(): Token {
    const str = localStorage.getItem(environment.TOKEN_KEY);
    return str !== null && str !== undefined ? JSON.parse(str) as Token : this.getEmpty();
  }

  private getEmpty(): Token {
    return { token: '', refreshToken: '', isEmpty: true };
  }
}
