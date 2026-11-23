import { Component, DestroyRef, NgZone, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '@api';

interface Statut {
  etat: 'a_jour' | 'en_attente' | 'en_cours' | 'echec' | 'non_configure';
  derniere: string | null;
  erreur: string | null;
}

/** Petit voyant : le site est-il à jour avec les dernières modifications ? Se met à jour tout seul. */
@Component({
  selector: 'app-site-statut',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (statut(); as s) {
      <span class="ss" [class]="'ss ss--' + s.etat" [title]="titre(s)">
        <i aria-hidden="true"></i>
        @switch (s.etat) {
          @case ('a_jour') { Site à jour @if (s.derniere) { <small>· publié le {{ s.derniere | date: 'dd/MM/yyyy' }} à {{ s.derniere | date: 'HH:mm' }}</small> } }
          @case ('en_attente') { Publication dans quelques secondes… }
          @case ('en_cours') { Publication en cours… }
          @case ('echec') { Échec de la publication, clique sur Republier }
          @case ('non_configure') { Publication non configurée }
        }
      </span>
    }
  `,
  styles: [
    `
      .ss {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.74rem;
        letter-spacing: 0.04em;
        color: var(--gv-muted);
      }
      .ss i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #3f9d63;
      }
      .ss small {
        font-size: 0.7rem;
      }
      .ss--en_attente i,
      .ss--en_cours i {
        background: #d9a031;
        animation: ss-pulse 1s ease-in-out infinite;
      }
      .ss--echec,
      .ss--non_configure {
        color: #d9534f;
      }
      .ss--echec i,
      .ss--non_configure i {
        background: #d9534f;
      }
      @keyframes ss-pulse {
        50% {
          opacity: 0.35;
        }
      }
    `,
  ],
})
export class SiteStatutComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly statut = signal<Statut | null>(null);

  ngOnInit(): void {
    this.charger();
    // Toutes les 4 s tant que la page est ouverte (hors détection de changements d'Angular).
    this.zone.runOutsideAngular(() => {
      const timer = setInterval(() => this.zone.run(() => this.charger()), 4000);
      this.destroyRef.onDestroy(() => clearInterval(timer));
    });
  }

  private charger(): void {
    this.api.get('site/statut').subscribe((r) => {
      if (r.result && r.data) this.statut.set(r.data as Statut);
    });
  }

  titre(s: Statut): string {
    return s.erreur ? `Dernière erreur : ${s.erreur}` : 'Les modifications sont publiées sur le site automatiquement, environ 4 secondes après chaque changement.';
  }
}
