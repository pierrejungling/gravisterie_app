import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent, SafeResourceUrlPipe } from '@shared';
import { RealtimeService } from '@api';
import { StatutCommande } from '../../../commande/model/commande.interface';
import { ClientApiService } from '../../service/client-api.service';
import {
  ClientPayload,
  CommandeClientResume,
  FicheClientDetail,
  STATUT_LABELS,
  adresseUtile,
  dateCourte,
  euros,
  initialesClient,
  nomClient,
  toneStatut,
} from '../../model/client.interface';

@Component({
  selector: 'app-client-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HeaderComponent, SafeResourceUrlPipe],
  templateUrl: './client-detail-page.component.html',
  styleUrl: './client-detail-page.component.scss',
})
export class ClientDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientApi = inject(ClientApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly nomClient = nomClient;
  readonly initialesClient = initialesClient;
  readonly euros = euros;
  readonly dateCourte = dateCourte;
  readonly toneStatut = toneStatut;
  readonly adresseUtile = adresseUtile;

  readonly client = signal<FicheClientDetail | null>(null);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);

  readonly edition = signal(false);
  readonly sauvegarde = signal(false);
  readonly editionErreur = signal<string | null>(null);
  form: ClientPayload = {};

  readonly notes = signal('');
  readonly notesSauvegarde = signal<'idle' | 'saving' | 'saved'>('idle');

  readonly suppressionConfirm = signal(false);
  readonly copie = signal<string | null>(null);

  readonly filtreHistorique = signal<'toutes' | 'en_cours' | 'terminees'>('toutes');

  private id = '';

  readonly commandes = computed<CommandeClientResume[]>(() => {
    const list = this.client()?.commandes ?? [];
    const filtre = this.filtreHistorique();
    return list.filter((c) => {
      const fini = c.statut_commande === StatutCommande.TERMINE || c.statut_commande === StatutCommande.ANNULEE;
      if (filtre === 'en_cours') return !fini;
      if (filtre === 'terminees') return fini;
      return true;
    });
  });

  readonly clientDepuis = computed(() => {
    const d = this.client()?.stats.premiere_commande;
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date.toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' });
  });

  readonly notesModifiees = computed(() => (this.client()?.notes || '') !== this.notes());

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = params.get('id') || '';
      this.edition.set(false);
      this.suppressionConfirm.set(false);
      this.charger(true);
    });
    this.realtime
      .on('client', 'commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.resource === 'client' && event.action === 'deleted' && event.id === this.id) {
          this.router.navigate(['/dashboard', 'clients']);
          return;
        }
        if (!this.edition()) this.charger(false);
      });
  }

  charger(afficherChargement: boolean): void {
    if (!this.id) return;
    if (afficherChargement) this.loading.set(true);
    this.clientApi.detail(this.id).subscribe({
      next: (client) => {
        this.loading.set(false);
        if (!client) {
          this.erreur.set('Fiche introuvable.');
          return;
        }
        const notesAvant = this.client()?.notes || '';
        this.client.set(client);
        // Ne pas écraser des notes en cours de saisie.
        if (this.notes() === notesAvant) this.notes.set(client.notes || '');
        this.erreur.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set('Fiche introuvable.');
      },
    });
  }

  // ---------- Coordonnées ----------
  commencerEdition(): void {
    const c = this.client();
    if (!c) return;
    this.form = {
      prenom: c.prénom || '',
      nom: c.nom || '',
      societe: c.société || '',
      mail: c.mail || '',
      telephone: c.téléphone || '',
      adresse: adresseUtile(c.adresse) || '',
      tva: c.tva || '',
    };
    this.editionErreur.set(null);
    this.edition.set(true);
  }

  annulerEdition(): void {
    this.edition.set(false);
  }

  enregistrer(): void {
    const p = this.form;
    if (![p.nom, p.prenom, p.societe].some((v) => v && v.trim())) {
      this.editionErreur.set('Il faut au moins un nom, un prénom ou une société.');
      return;
    }
    this.sauvegarde.set(true);
    this.clientApi.modifier(this.id, p).subscribe({
      next: (res) => {
        this.sauvegarde.set(false);
        if (!res) {
          this.editionErreur.set('Enregistrement impossible.');
          return;
        }
        this.edition.set(false);
        this.charger(false);
      },
      error: (err) => {
        this.sauvegarde.set(false);
        this.editionErreur.set(err?.error?.message || 'Enregistrement impossible.');
      },
    });
  }

  // ---------- Notes ----------
  setNotes(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
    this.notesSauvegarde.set('idle');
  }

  enregistrerNotes(): void {
    if (!this.notesModifiees()) return;
    this.notesSauvegarde.set('saving');
    this.clientApi.modifier(this.id, { notes: this.notes() }).subscribe({
      next: (res) => {
        if (!res) {
          this.notesSauvegarde.set('idle');
          return;
        }
        this.client.update((c) => (c ? { ...c, notes: this.notes() } : c));
        this.notesSauvegarde.set('saved');
      },
      error: () => this.notesSauvegarde.set('idle'),
    });
  }

  // ---------- Actions ----------
  copier(valeur: string | null, cle: string): void {
    if (!valeur) return;
    navigator.clipboard?.writeText(valeur).then(() => {
      this.copie.set(cle);
      setTimeout(() => this.copie.set(null), 1400);
    });
  }

  nouvelleCommande(): void {
    this.router.navigate(['/dashboard', 'commandes', 'nouvelle'], { queryParams: { client: this.id } });
  }

  ouvrirCommande(c: CommandeClientResume): void {
    this.router.navigate(['/dashboard', 'commandes', 'detail', c.id_commande]);
  }

  supprimer(): void {
    if (!this.suppressionConfirm()) {
      this.suppressionConfirm.set(true);
      return;
    }
    this.clientApi.supprimer(this.id).subscribe({
      next: (ok) => {
        if (ok) this.router.navigate(['/dashboard', 'clients']);
        else this.erreur.set('Suppression impossible.');
      },
      error: (err) => this.erreur.set(err?.error?.message || 'Suppression impossible.'),
    });
  }

  libelleStatut(c: CommandeClientResume): string {
    return STATUT_LABELS[c.statut_commande] || c.statut_commande;
  }

  mapsUrl(adresse: string): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresse);
  }

  /** Aperçu Google Maps intégré (même rendu que le détail commande). */
  mapEmbedUrl(adresse: string): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(adresse)}&z=16&output=embed`;
  }

  telUrl(tel: string): string {
    return 'tel:' + tel.replace(/[^\d+]/g, '');
  }
}
