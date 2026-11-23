import { Component, effect, inject, input, signal } from '@angular/core';
import { TrajetAtelierService, formatDistance, formatDuree } from './trajet-atelier.service';

/**
 * Ligne « Depuis l'atelier (Spa) · 42 km · ~38 min en voiture », à placer sous une carte.
 * Usage : <gv-trajet-atelier [adresse]="adresse"></gv-trajet-atelier>
 */
@Component({
  selector: 'gv-trajet-atelier',
  standalone: true,
  template: `
    <span class="trajet__label">Depuis l'atelier (Spa)</span>
    @switch (etat()) {
      @case ('chargement') { <span class="trajet__muted">Calcul du trajet…</span> }
      @case ('erreur') { <span class="trajet__muted">{{ erreur() }}</span> }
      @case ('ok') {
        <span class="trajet__val">{{ distance() }}</span>
        <span class="trajet__sep" aria-hidden="true">·</span>
        <span class="trajet__val">{{ duree() }}</span>
        <span class="trajet__muted">en voiture</span>
      }
    }
  `,
  host: { class: 'trajet', 'aria-live': 'polite', '[hidden]': "etat() === 'vide'" },
  styles: [
    `
      :host {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 0.2rem 0.5rem;
        margin-top: 0.45rem;
        font-size: 0.82rem;
        color: var(--color-text);
      }
      :host([hidden]) {
        display: none;
      }
      .trajet__label {
        font-family: var(--font-title);
        font-size: 0.58rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--gv-muted);
        margin-right: 0.15rem;
      }
      .trajet__val {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
      }
      .trajet__sep,
      .trajet__muted {
        color: var(--gv-muted);
      }
    `,
  ],
})
export class TrajetAtelierComponent {
  private readonly service = inject(TrajetAtelierService);

  readonly adresse = input<string | null | undefined>(null);

  readonly etat = signal<'vide' | 'chargement' | 'ok' | 'erreur'>('vide');
  readonly distance = signal('');
  readonly duree = signal('');
  readonly erreur = signal('');

  private requete = 0;

  constructor() {
    effect(() => {
      const adresse = (this.adresse() || '').trim();
      void this.calculer(adresse);
    });
  }

  private async calculer(adresse: string): Promise<void> {
    const id = ++this.requete;
    if (!adresse) {
      this.etat.set('vide');
      return;
    }
    this.etat.set('chargement');
    try {
      const t = await this.service.trajetDepuisAtelier(adresse);
      if (id !== this.requete) return;
      if (!t) {
        this.erreur.set('Adresse introuvable pour le calcul du trajet');
        this.etat.set('erreur');
        return;
      }
      this.distance.set(formatDistance(t.distanceM));
      this.duree.set(formatDuree(t.durationSec));
      this.etat.set('ok');
    } catch {
      if (id !== this.requete) return;
      this.erreur.set('Impossible de calculer le trajet');
      this.etat.set('erreur');
    }
  }
}
