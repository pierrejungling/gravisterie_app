import { Injectable, NgZone, effect, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';
import { RealtimeEvent, RealtimeResource } from '../model/realtime-event';
import { AuthSessionService } from './auth-session.service';
import { ClientIdService } from './client-id.service';
import { TokenService } from './token.service';
import { Token } from '../model';

@Injectable({
  providedIn: 'root',
})
export class RealtimeService {
  readonly clientId = inject(ClientIdService).clientId;

  private readonly tokenService = inject(TokenService);
  private readonly authSession = inject(AuthSessionService);
  private readonly zone = inject(NgZone);
  private readonly changesSubject = new Subject<RealtimeEvent>();

  private generation = 0;
  private activeToken: string | null = null;
  private abort: AbortController | null = null;

  constructor() {
    effect(() => this.sync(this.tokenService.token()));
  }

  /** Maintient la connexion ouverte tant que l'utilisateur est connecté. */
  start(): void {
    this.sync(this.tokenService.token());
  }

  on(...resources: RealtimeResource[]): Observable<RealtimeEvent> {
    return this.changesSubject.pipe(
      filter((event) => resources.includes(event.resource)),
      debounceTime(400),
    );
  }

  private sync(token: Token): void {
    const value = !token.isEmpty && token.token.trim() ? token.token : null;
    if (value === this.activeToken && (value === null || this.abort)) {
      return;
    }
    this.activeToken = value;
    this.open(value);
  }

  private open(token: string | null): void {
    this.stop();
    if (!token) {
      return;
    }

    const generation = ++this.generation;
    const controller = new AbortController();
    this.abort = controller;
    void this.listen(token, generation, controller);
  }

  private stop(): void {
    this.abort?.abort();
    this.abort = null;
  }

  private async listen(token: string, generation: number, controller: AbortController): Promise<void> {
    let retryMs = 1000;

    while (!controller.signal.aborted && generation === this.generation) {
      try {
        const response = await fetch(`${environment.apiURL}events`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          this.authSession.refreshAccessToken().subscribe({ error: () => undefined });
          return;
        }

        if (!response.ok || !response.body) {
          throw new Error(`Flux temps réel indisponible (${response.status})`);
        }

        retryMs = 1000;
        await this.readStream(response.body, controller.signal);
        if (controller.signal.aborted || generation !== this.generation) {
          return;
        }
      } catch {
        if (controller.signal.aborted || generation !== this.generation) {
          return;
        }
      }

      await this.delay(retryMs, controller.signal);
      retryMs = Math.min(retryMs * 2, 15000);
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>, signal: AbortSignal): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        const raw = chunk
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');
        if (!raw) {
          continue;
        }

        try {
          const parsed = JSON.parse(raw) as RealtimeEvent & { type?: string };
          if (!parsed.resource || (parsed.origin && parsed.origin === this.clientId)) {
            continue;
          }
          this.zone.run(() => this.changesSubject.next(parsed));
        } catch {
          // fragment incomplet ou commentaire de maintien
        }
      }
    }
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
