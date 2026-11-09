import { Component, DestroyRef, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApercuLien, ApercuLienService, EtatApercu } from '../../service/apercu-lien.service';

/**
 * Vignette d'un lien de frais : image et titre de la page.
 * - taille « carte » : vignette + titre + site, avec « Changer l'image »
 * - taille « mini » : petite vignette seule (tableau « Détails des frais »)
 */
@Component({
  selector: 'gv-apercu-lien',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './apercu-lien.component.html',
  styleUrl: './apercu-lien.component.scss',
})
export class ApercuLienComponent implements OnChanges {
  private readonly service = inject(ApercuLienService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly url$ = new Subject<string | null>();
  private abonnement?: Subscription;
  private premier = true;

  @Input() url: string | null | undefined = null;
  @Input() taille: 'carte' | 'mini' = 'carte';
  /** Attente avant de charger quand le lien est en cours de saisie. */
  @Input() delai = 0;

  readonly lien = signal<string | null>(null);
  readonly etat = signal<EtatApercu>(null);
  readonly imageKo = signal(false);
  readonly edition = signal(false);
  readonly saisie = signal('');
  readonly envoi = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly grand = signal(false);

  constructor() {
    // Lien en cours de saisie : on attend que la frappe se calme avant de charger.
    this.url$
      .pipe(
        debounce(() => timer(this.delai)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => this.appliquer(url));
    this.destroyRef.onDestroy(() => this.abonnement?.unsubscribe());
  }

  ngOnChanges(): void {
    const url = this.service.normaliser(this.url);
    if (!this.premier && url === this.lien()) return;
    if (this.premier || !this.delai) this.appliquer(url);
    else this.url$.next(url);
    this.premier = false;
  }

  private appliquer(url: string | null): void {
    if (url === this.lien() && this.etat() !== null) return;
    this.abonnement?.unsubscribe();
    this.lien.set(url);
    this.imageKo.set(false);
    this.edition.set(false);
    if (!url) {
      this.etat.set(null);
      return;
    }
    this.abonnement = this.service.suivre(url).subscribe((etat) => {
      this.etat.set(etat);
      this.imageKo.set(false);
    });
  }

  apercu(): ApercuLien | null {
    const e = this.etat();
    return e && typeof e === 'object' ? e : null;
  }

  image(): string | null {
    const a = this.apercu();
    return a?.image && !this.imageKo() ? a.image : null;
  }

  site(): string {
    const a = this.apercu();
    if (a?.site) return a.site;
    try {
      return new URL(this.lien() || '').hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  initiale(): string {
    return (this.site()[0] || '?').toUpperCase();
  }

  /** Certaines boutiques renvoient une image vide de 1 px quand le produit n'a pas de photo publique. */
  onLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth <= 2 || img.naturalHeight <= 2) this.imageKo.set(true);
  }

  ouvrir(): void {
    const url = this.lien();
    if (url) window.open(url, '_blank', 'noopener');
  }

  basculerGrand(event: Event): void {
    event.stopPropagation();
    if (this.image()) this.grand.update((v) => !v);
  }

  // ---------- Image à la main ----------
  ouvrirEdition(): void {
    this.saisie.set('');
    this.erreur.set(null);
    this.edition.set(true);
  }

  fermerEdition(): void {
    this.edition.set(false);
  }

  onSaisie(event: Event): void {
    this.saisie.set((event.target as HTMLInputElement).value);
  }

  /** Coller une image (capture d'écran, « Copier l'image ») directement dans le champ. */
  onPaste(event: ClipboardEvent): void {
    const fichier = Array.from(event.clipboardData?.items || [])
      .find((i) => i.kind === 'file' && i.type.startsWith('image/'))
      ?.getAsFile();
    if (!fichier) return;
    event.preventDefault();
    this.reduire(fichier).then(
      (data) => this.envoyer(data),
      () => this.erreur.set("Impossible de lire l'image collée."),
    );
  }

  onFichier(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fichier = input.files?.[0];
    input.value = '';
    if (!fichier) return;
    this.reduire(fichier).then(
      (data) => this.envoyer(data),
      () => this.erreur.set("Impossible de lire l'image."),
    );
  }

  valider(): void {
    const texte = this.saisie().trim();
    if (!/^https?:\/\/\S+$/i.test(texte)) {
      this.erreur.set("Colle l'adresse d'une image (clic droit sur l'image, « Copier l'adresse de l'image ») ou l'image elle-même.");
      return;
    }
    this.envoyer(texte);
  }

  automatique(): void {
    this.envoyer(null);
  }

  recharger(): void {
    const url = this.lien();
    if (url) this.service.recharger(url);
  }

  private envoyer(image: string | null): void {
    const url = this.lien();
    if (!url) return;
    this.envoi.set(true);
    this.erreur.set(null);
    this.service.changerImage(url, image).subscribe((ok) => {
      this.envoi.set(false);
      if (ok) this.edition.set(false);
      else this.erreur.set("L'image n'a pas pu être enregistrée.");
    });
  }

  /** Réduit l'image à 360 px de côté (JPEG) pour qu'elle reste légère. */
  private reduire(fichier: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = reject;
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const echelle = Math.min(1, 360 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * echelle));
          canvas.height = Math.max(1, Math.round(img.height * echelle));
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject();
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = String(lecteur.result);
      };
      lecteur.readAsDataURL(fichier);
    });
  }
}
