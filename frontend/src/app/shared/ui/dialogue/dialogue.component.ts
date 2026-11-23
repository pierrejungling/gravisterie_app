import { Component, ElementRef, HostListener, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogueService } from './dialogue.service';

@Component({
  selector: 'gv-dialogue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (service.courant(); as d) {
      <div class="gvd" (click)="annuler()">
        <div class="gvd__panel gv-panel" role="dialog" aria-modal="true" [attr.aria-label]="d.titre" (click)="$event.stopPropagation()">
          <div class="gv-eyebrow">{{ d.eyebrow || (d.champ ? 'Saisie' : d.danger ? 'Attention' : 'Confirmation') }}</div>
          <h2>{{ d.titre }}</h2>
          @if (d.message) { <p class="gvd__message">{{ d.message }}</p> }
          @if (d.champ) {
            <div class="gv-field gvd__champ">
              @if (d.champ.label) { <label for="gvd-champ">{{ d.champ.label }}</label> }
              <input id="gvd-champ" class="gv-input" data-focus [placeholder]="d.champ.placeholder || ''" [ngModel]="saisie()" (ngModelChange)="saisie.set($event)" />
            </div>
          }
          <div class="gvd__actions">
            <button type="button" class="gv-btn gv-btn--ghost" (click)="annuler()">{{ d.annuler || 'Annuler' }}</button>
            <button type="button" class="gv-btn" [class.gv-btn--danger]="d.danger" [class.gv-btn--primary]="!d.danger" [attr.data-focus]="d.champ ? null : ''" (click)="valider()">
              {{ d.confirmer || (d.danger ? 'Supprimer' : 'Confirmer') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .gvd {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: grid;
        place-items: center;
        padding: 1rem;
        background: rgba(13, 12, 11, 0.55);
        backdrop-filter: blur(4px);
        animation: gvd-fond 0.2s ease;
      }
      .gvd__panel {
        width: min(460px, 100%);
        padding: 1.4rem 1.4rem 1.2rem;
        background: var(--gv-paper);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        animation: gvd-entree 0.25s ease;
      }
      h2 {
        margin: 0.2rem 0 0.7rem;
        font-family: var(--font-title);
        font-size: 1.25rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .gvd__message {
        margin: 0 0 0.4rem;
        line-height: 1.55;
        color: var(--gv-ink);
        white-space: pre-line;
      }
      .gvd__champ {
        margin-top: 0.8rem;
      }
      .gvd__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.2rem;
      }
      @keyframes gvd-fond {
        from { opacity: 0; }
      }
      @keyframes gvd-entree {
        from { opacity: 0; transform: translateY(10px) scale(0.98); }
      }
    `,
  ],
})
export class DialogueComponent {
  readonly service = inject(DialogueService);
  private readonly hote = inject(ElementRef<HTMLElement>);
  readonly saisie = signal('');

  constructor() {
    effect(() => {
      const d = this.service.courant();
      if (!d) return;
      this.saisie.set(d.champ?.valeur ?? '');
      // Le focus va sur le champ, ou sur le bouton principal.
      setTimeout(() => (this.hote.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-focus]')?.focus(), 30);
    });
  }

  annuler(): void {
    this.service.fermer(this.service.courant()?.champ ? null : false);
  }

  valider(): void {
    const d = this.service.courant();
    if (!d) return;
    if (d.champ) {
      const texte = this.saisie().trim();
      if (!texte) return;
      this.service.fermer(texte);
    } else {
      this.service.fermer(true);
    }
  }

  @HostListener('document:keydown', ['$event'])
  clavier(e: KeyboardEvent): void {
    if (!this.service.courant()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.annuler();
    } else if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
      e.preventDefault();
      this.valider();
    }
  }
}
