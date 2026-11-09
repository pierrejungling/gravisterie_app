import { Component, OnDestroy, OnInit, signal } from '@angular/core';

/**
 * Une ligne de code qui s'écrit toute seule dans la barre du haut.
 * Le choix dépend du moment de la journée, puis tourne au hasard.
 * Pur décor : aria-hidden, muet, discret.
 */
const LIGNES: { de: number; a: number; lignes: string[] }[] = [
  {
    de: 5,
    a: 8,
    lignes: [
      'soleil.lever("Spa"); cafe.lancer();',
      'sac.check(["couteau", "lampe", "briquet", "paracord"]);',
      'const cap = boussole.nord(); go(cap);',
      'fanfreluche.reveiller(); // elle était déjà debout',
    ],
  },
  {
    de: 8,
    a: 12,
    lignes: [
      'atelier.ouvrir(); laser.homing();',
      'commandes.trier("urgent")[0].graver();',
      'laser.focus({ distance: "parfaite" });',
      'carnet.noter(idee); // avant qu\'elle s\'envole',
    ],
  },
  {
    de: 12,
    a: 14,
    lignes: [
      'pause({ duree: "30 min", lieu: "dehors" });',
      'fanfreluche.nourrir(); // sinon gare aux mollets',
      'if (soleil) { panneaux.produire(); }',
    ],
  },
  {
    de: 14,
    a: 18,
    lignes: [
      'while (file.length) { graver(file.shift()); }',
      'voiles.hisser(); cap(-20.00, 57.57); // Pamplemousse',
      'if (faisceau.force === "avec toi") { graver(); }',
      'const navire = "Black Pearl"; navire.larguer();',
    ],
  },
  {
    de: 18,
    a: 22,
    lignes: [
      'soleil.coucher("Spa"); laser.refroidir();',
      'bivouac.monter({ lieu: "Hautes Fagnes", lanterne: true });',
      'verre.servir({ malt: "Highland Park", age: 12 });',
      'rhum.arranger({ origine: "Maurice", patience: Infinity });',
    ],
  },
  {
    de: 22,
    a: 29,
    lignes: [
      'while (monde.dort()) { idees.noter(); }',
      'lumos(); // Fanfreluche veille sur l\'atelier',
      'mefaitAccompli(); laser.off();',
      'if (!rules) { createFreedom(); }',
      'etoiles.compter(); // on reprend demain',
    ],
  },
];

function lignesDuMoment(d: Date): string[] {
  const h = d.getHours() < 5 ? d.getHours() + 24 : d.getHours();
  return (LIGNES.find((t) => h >= t.de && h < t.a) ?? LIGNES[0]).lignes;
}

@Component({
  selector: 'gv-ligne-du-jour',
  standalone: true,
  template: `<span class="ldj" aria-hidden="true"><span class="ldj__p">›</span>{{ texte() }}<span class="ldj__c"></span></span>`,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        overflow: hidden;
        pointer-events: none;
        user-select: none;
      }
      .ldj {
        display: block;
        font-family: var(--font-mono);
        font-size: 0.72rem;
        letter-spacing: 0.02em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        color: color-mix(in srgb, var(--gv-ink) 36%, transparent);
      }
      .ldj__p {
        margin-right: 0.5rem;
        color: color-mix(in srgb, var(--gv-accent) 70%, transparent);
      }
      .ldj__c {
        display: inline-block;
        width: 0.5em;
        height: 1em;
        margin-left: 1px;
        vertical-align: -0.15em;
        background: color-mix(in srgb, var(--gv-accent) 60%, transparent);
        animation: ldj-clignote 1.1s steps(1) infinite;
      }
      @keyframes ldj-clignote {
        50% { opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ldj__c { animation: none; }
      }
    `,
  ],
})
export class LigneDuJourComponent implements OnInit, OnDestroy {
  readonly texte = signal('');

  private timer: ReturnType<typeof setTimeout> | null = null;
  private derniere = '';
  private readonly calme =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  ngOnInit(): void {
    this.suivante();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private tirer(): string {
    const choix = lignesDuMoment(new Date()).filter((l) => l !== this.derniere);
    const l = choix[Math.floor(Math.random() * choix.length)];
    this.derniere = l;
    return l;
  }

  private attendre(ms: number, ensuite: () => void): void {
    this.timer = setTimeout(ensuite, ms);
  }

  private suivante(): void {
    const ligne = this.tirer();
    if (this.calme) {
      this.texte.set(ligne);
      this.attendre(120000, () => this.suivante());
      return;
    }
    this.ecrire(ligne, 0);
  }

  /** Frappe lettre par lettre, rythme légèrement irrégulier. */
  private ecrire(ligne: string, i: number): void {
    this.texte.set(ligne.slice(0, i));
    if (i < ligne.length) {
      this.attendre(45 + Math.random() * 70, () => this.ecrire(ligne, i + 1));
    } else {
      this.attendre(45000 + Math.random() * 30000, () => this.effacer(ligne.length));
    }
  }

  private effacer(n: number): void {
    this.texte.set(this.texte().slice(0, n));
    if (n > 0) {
      this.attendre(18, () => this.effacer(n - 1));
    } else {
      this.attendre(900, () => this.suivante());
    }
  }
}
