import { Component, HostListener, input, output } from '@angular/core';

/** Ce que l'on fait des coordonnées modifiées d'un client déjà en base. */
export type ChoixFicheClient = 'fiche' | 'nouvelle';

/**
 * Question posée quand on modifie les coordonnées d'un client qui a déjà sa fiche :
 * mettre la fiche à jour (le changement vaut pour toutes ses commandes)
 * ou créer une nouvelle fiche pour cette commande, sans toucher à l'ancienne.
 */
@Component({
  selector: 'gv-choix-fiche-client',
  standalone: true,
  template: `
    <div class="cfc" (click)="annule.emit()">
      <div class="cfc__boite" role="dialog" aria-modal="true" aria-labelledby="cfc-titre" (click)="$event.stopPropagation()">
        <p class="cfc__sur">Fiche client</p>
        <h3 class="cfc__titre" id="cfc-titre">Tu as modifié les coordonnées{{ nom() ? ' de ' + nom() : '' }}</h3>
        <p class="cfc__texte">
          @if (nbAutres() > 0) {
            Cette fiche sert aussi à {{ nbAutres() }} {{ nbAutres() > 1 ? 'autres commandes' : 'autre commande' }}.
          } @else {
            Ce client a déjà sa fiche dans la base.
          }
          Que veux-tu faire de ces changements ?
        </p>
        @if (changements().length > 0) {
          <p class="cfc__champs">Modifié : {{ changements().join(', ') }}</p>
        }
        <div class="cfc__choix">
          <button type="button" class="cfc__option" (click)="choisi.emit('fiche')">
            <span class="cfc__option-titre">Modifier la fiche</span>
            <span class="cfc__option-detail">Le changement vaut pour toutes les commandes de ce client.</span>
          </button>
          <button type="button" class="cfc__option" (click)="choisi.emit('nouvelle')">
            <span class="cfc__option-titre">Créer une nouvelle fiche</span>
            <span class="cfc__option-detail">Cette commande passe sur une copie de la fiche avec ces changements. L'ancienne fiche ne bouge pas.</span>
          </button>
        </div>
        <div class="cfc__pied">
          <button type="button" class="gv-btn gv-btn--ghost gv-btn--sm" (click)="annule.emit()">Annuler</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .cfc {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(13, 12, 11, 0.45);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
      }
      .cfc__boite {
        width: min(520px, 100%);
        max-height: 100%;
        overflow-y: auto;
        padding: 1.25rem 1.35rem 1.1rem;
        border: 1px solid var(--gv-line);
        border-left: 3px solid var(--gv-accent);
        border-radius: var(--border-radius);
        background: var(--gv-panel);
        color: var(--gv-ink);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
      }
      .cfc__sur {
        margin: 0 0 0.3rem;
        font-family: var(--font-title);
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gv-accent);
      }
      .cfc__titre {
        margin: 0 0 0.5rem;
        font-family: var(--font-title);
        font-size: 1.15rem;
        font-weight: 700;
        line-height: 1.25;
      }
      .cfc__texte {
        margin: 0 0 0.5rem;
        font-size: 0.9rem;
        line-height: 1.5;
      }
      .cfc__champs {
        margin: 0 0 0.5rem;
        font-size: 0.8rem;
        color: var(--gv-muted);
      }
      .cfc__choix {
        display: grid;
        gap: 0.55rem;
        margin-top: 0.9rem;
      }
      .cfc__option {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        width: 100%;
        padding: 0.75rem 0.9rem;
        border: 1px solid var(--gv-line-strong);
        border-radius: var(--border-radius);
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;
      }
      .cfc__option:hover,
      .cfc__option:focus-visible {
        border-color: var(--gv-accent);
        background: color-mix(in srgb, var(--gv-accent) 7%, transparent);
      }
      .cfc__option-titre {
        font-family: var(--font-title);
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .cfc__option-detail {
        font-size: 0.84rem;
        line-height: 1.4;
        color: var(--gv-muted);
      }
      .cfc__pied {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.9rem;
      }
    `,
  ],
})
export class ChoixFicheClientComponent {
  /** Nom du client, pour le titre. */
  readonly nom = input<string>('');
  /** Nombre d'autres commandes liées à la fiche. */
  readonly nbAutres = input<number>(0);
  /** Libellés des coordonnées modifiées. */
  readonly changements = input<string[]>([]);

  readonly choisi = output<ChoixFicheClient>();
  readonly annule = output<void>();

  @HostListener('document:keydown.escape')
  fermer(): void {
    this.annule.emit();
  }
}
