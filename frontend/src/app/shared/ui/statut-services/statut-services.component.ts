import { Component, DestroyRef, NgZone, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';

type Etat = 'verif' | 'ok' | 'ko' | 'inconnu';

/**
 * Trois voyants pour savoir d'un coup d'oeil ce qui ne va pas quand on n'arrive pas à se connecter :
 * l'interface (toujours verte, sinon la page ne s'afficherait pas), le serveur de l'app, la base de données.
 */
@Component({
  selector: 'app-statut-services',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul class="st" aria-label="État des services">
      <li [class]="'st__li st__li--' + front()" title="L'interface s'affiche : elle est toujours en ligne.">
        <i aria-hidden="true"></i><span>Interface</span>
      </li>
      <li [class]="'st__li st__li--' + back()" [title]="titreBack()">
        <i aria-hidden="true"></i><span>Serveur</span>
        @if (back() === 'ok' && ms() !== null) { <small>{{ ms() }} ms</small> }
      </li>
      <li [class]="'st__li st__li--' + base()" [title]="titreBase()">
        <i aria-hidden="true"></i><span>Base de données</span>
      </li>
    </ul>
    @if (cible(); as c) {
      <p class="st__env" [class.st__env--alerte]="c.alerte">{{ c.texte }}</p>
    }
    @if (back() === 'ko') {
      <p class="st__msg">Le serveur ne répond pas. Réessaie dans un instant ; s'il vient de redémarrer, cela peut prendre une minute.</p>
    } @else if (back() === 'ok' && base() === 'ko') {
      <p class="st__msg">Le serveur répond, mais la base de données est injoignable.</p>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .st {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4rem 1.2rem;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--gv-muted, #8a8580);
      }
      .st__li {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }
      .st__li i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6f6a65;
      }
      .st__li small {
        text-transform: none;
        letter-spacing: 0;
        opacity: 0.8;
      }
      .st__li--ok i {
        background: #3f9d63;
      }
      .st__li--ko i {
        background: #d9534f;
      }
      .st__li--ko {
        color: #d9534f;
      }
      .st__li--verif i {
        background: #d9a031;
        animation: st-pulse 1s ease-in-out infinite;
      }
      @keyframes st-pulse {
        50% {
          opacity: 0.35;
        }
      }
      .st__env {
        margin: 0.7rem 0 0;
        text-align: center;
        font-size: 0.7rem;
        letter-spacing: 0.04em;
        color: var(--gv-muted, #8a8580);
      }
      .st__env--alerte {
        color: #d9a031;
      }
      .st__msg {
        margin: 0.6rem 0 0;
        text-align: center;
        font-size: 0.78rem;
        color: #d9534f;
      }
    `,
  ],
})
export class StatutServicesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly front = signal<Etat>('ok');
  readonly back = signal<Etat>('verif');
  readonly base = signal<Etat>('verif');
  readonly ms = signal<number | null>(null);
  /** Mode annoncé par le serveur qui répond (development ou production). */
  readonly modeServeur = signal<string | null>(null);

  /** À quel serveur cette page parle : en local, le proxy renvoie vers localhost, jamais vers Render. */
  cible(): { texte: string; alerte: boolean } | null {
    if (this.back() !== 'ok') return null;
    const api = environment.apiURL;
    const local = api.startsWith('/') && location.hostname === 'localhost';
    const hote = api.startsWith('/') ? location.host : new URL(api).host;
    const enProd = this.modeServeur() === 'production';
    if (local && enProd) return { texte: 'Attention : en local, mais le serveur répond en mode production.', alerte: true };
    return { texte: local ? 'Local : les appels vont vers le serveur localhost:2023, pas vers Render' : `Production : ${hote}`, alerte: false };
  }

  ngOnInit(): void {
    this.verifier();
    this.zone.runOutsideAngular(() => {
      const timer = setInterval(() => this.zone.run(() => this.verifier()), 10000);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  private verifier(): void {
    const debut = performance.now();
    this.http
      .get<any>(`${environment.apiURL}health`)
      .pipe(timeout(8000))
      .subscribe({
        next: (reponse) => {
          // Selon les réponses, les données sont à la racine ou sous `data`.
          const sante = reponse?.data ?? reponse;
          this.back.set('ok');
          this.ms.set(Math.round(performance.now() - debut));
          this.modeServeur.set(sante?.environment ?? null);
          this.base.set(sante?.database === 'connected' ? 'ok' : 'ko');
        },
        error: () => {
          this.back.set('ko');
          this.ms.set(null);
          this.base.set('inconnu');
        },
      });
  }

  titreBack(): string {
    return this.back() === 'ok' ? 'Le serveur de l\'application répond.' : this.back() === 'ko' ? 'Le serveur ne répond pas.' : 'Vérification…';
  }

  titreBase(): string {
    return this.base() === 'ok' ? 'La base de données répond.' : this.base() === 'ko' ? 'La base de données ne répond pas.' : this.base() === 'inconnu' ? 'Inconnu : le serveur ne répond pas.' : 'Vérification…';
  }
}
