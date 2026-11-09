import { Component, computed, input } from '@angular/core';

/**
 * Petit bout de code décoratif, comme ceux gravés sur certaines planches.
 * Pur décor : aria-hidden, non sélectionnable, discret.
 */
const BOUTS: Record<string, string> = {
  liberte: `const latitude  = "20°00'25\\" S";
const longitude = "57°34'41\\" E";

if (!rules) { createFreedom(); }

while (alive) {
  explore();
  create();
}

setDestination(latitude, longitude);`,
  atelier: `const atelier = { lat: "50°29' N", lon: "5°51' E" };

laser.focus(atelier);
for (const idee of idees) {
  grave(idee, { precision: 0.1 });
}`,
  lumiere: `// pas de laiton, pas de CNC : juste de la lumière
const faisceau = new Laser({ puissance: 40 });
faisceau.on("matiere", (m) => m.revele());`,
  cap: `const navire = "Black Pearl";
const equipage = ["Pierre", "Fanfreluche"];

navire.hisser("pavillon noir");
navire.cap("Pamplemousse"); // un jour`,
  repos: `if (atelier.vide()) {
  cafe.servir();
  idees.noter();
}
return "à demain";`,
  edc: `const edc = {
  immediat:      ["couteau", "lampe", "briquet"],
  intermediaire: ["paracord", "trousse", "multitool"],
  etendu:        ["sac", "bivouac", "carte"],
};

if (imprevu) { edc.deployer(); }`,
  bivouac: `const nuit = new Bivouac({ lieu: "Hautes Fagnes" });
nuit.tente.monter();
nuit.lanterne.allumer();

while (etoiles.visibles()) {
  regarder();
}`,
  ecriture: `// écrire d'abord, graver ensuite
const idee = carnet.noter(encre);

if (idee.tient()) {
  laser.graver(idee);
}`,
  orcades: `const verre = { malt: "Highland Park", age: 12 };

if (journee.finie()) {
  savourer(verre, { glace: false });
}`,
  maraudeur: `jureSolennellement(); // mes intentions sont mauvaises
atelier.carte.reveler();

// ...
mefaitAccompli();`,
  force: `const faisceau = laser.calibrer();

if (faisceau.force === "avec toi") {
  graver(); // toujours
}`,
  meute: `const meute = ["Fanfreluche"];

meute.push("Saarloos"); // un jour
meute.forEach((m) => m.balade("Spa"));`,
};

const MOTS = /\b(const|let|new|if|while|for|of|return|true|false)\b/g;

function colorer(code: string): string {
  const echappe = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return echappe
    .split('\n')
    .map((ligne) => {
      const i = ligne.indexOf('//');
      const avant = i >= 0 ? ligne.slice(0, i) : ligne;
      const com = i >= 0 ? `<span class="c">${ligne.slice(i)}</span>` : '';
      return (
        avant
          .replace(/"(?:[^"\\]|\\.)*"/g, (s) => `<span class="s">${s}</span>`)
          .replace(MOTS, '<span class="k">$1</span>')
          .replace(/\b([a-zA-Z]+)(?=\()/g, '<span class="f">$1</span>') + com
      );
    })
    .join('\n');
}

@Component({
  selector: 'gv-code-deco',
  standalone: true,
  template: `<pre class="gv-code-deco" aria-hidden="true" [innerHTML]="html()"></pre>`,
  styles: [
    `
      :host {
        display: block;
        pointer-events: none;
        user-select: none;
      }
      .gv-code-deco {
        margin: 0;
        font-family: var(--font-mono);
        font-size: 0.72rem;
        line-height: 1.55;
        color: color-mix(in srgb, var(--gv-ink) 38%, transparent);
        white-space: pre;
        overflow: hidden;
      }
      :host ::ng-deep .k { color: color-mix(in srgb, var(--gv-accent) 70%, transparent); }
      :host ::ng-deep .s { color: color-mix(in srgb, var(--gv-ink) 55%, transparent); }
      :host ::ng-deep .f { color: color-mix(in srgb, var(--gv-ink) 52%, transparent); }
      :host ::ng-deep .c { font-style: italic; color: color-mix(in srgb, var(--gv-ink) 30%, transparent); }
    `,
  ],
})
export class CodeDecoComponent {
  /** Nom du bout de code ; « hasard » en tire un au chargement. */
  readonly bout = input<string>('hasard');

  private readonly tirage = Object.keys(BOUTS)[Math.floor(Math.random() * Object.keys(BOUTS).length)];

  readonly html = computed(() => colorer(BOUTS[this.bout()] ?? BOUTS[this.tirage]));
}
