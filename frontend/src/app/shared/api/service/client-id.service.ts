import { Injectable } from '@angular/core';

const CLIENT_ID_KEY = 'gravisterie-client-id';

@Injectable({
  providedIn: 'root',
})
export class ClientIdService {
  readonly clientId = this.readClientId();

  private readClientId(): string {
    try {
      const existing = sessionStorage.getItem(CLIENT_ID_KEY);
      if (existing) {
        return existing;
      }
      const created = crypto.randomUUID();
      sessionStorage.setItem(CLIENT_ID_KEY, created);
      return created;
    } catch {
      return crypto.randomUUID();
    }
  }
}
