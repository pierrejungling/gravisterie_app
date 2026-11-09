import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent, SafeResourceUrlPipe } from '@shared';
import { ApiService, ApiURI, RealtimeService } from '@api';
import { Commande, StatutCommande, getCommandeSiteDisplayTitle } from '../../../commande/model/commande.interface';
import { ClientPickerComponent } from '../../../client/component/client-picker/client-picker.component';
import { FicheClient, adresseUtile } from '../../../client/model/client.interface';
import { EvenementApiService } from '../../service/evenement-api.service';
import {
  CommandeEvenement,
  ElementMateriel,
  EvenementDetail,
  EvenementPayload,
  FORMULES_EVENEMENT,
  FormuleEvenement,
  STATUTS_EVENEMENT,
  STATUT_LABELS,
  StatutEvenement,
  TARIFS_DIRECT,
  TYPES_EVENEMENT,
  TypeEvenement,
  aVenir,
  calculFormules,
  dateCourte,
  dateLongue,
  depuisChampDate,
  euros,
  horaire,
  joursAvant,
  nombre,
  nomClientEvenement,
  statutEvenement,
  toneStatut,
  typeEvenement,
  versChampDate,
} from '../../model/evenement.interface';

/** Liste type pour une gravure en direct (ajoutée d'un clic). */
const MATERIEL_TYPE: string[] = [
  'Graveuse portable + câble',
  'Rallonge / multiprise',
  'Table pliante + nappe noire',
  'Chaise',
  'Bougies / objets apprêtés',
  'Gouache noire ou marqueur + éponge',
  'Microfibre',
  'Lunettes de protection',
  'Terminal de paiement',
  'Cartes de visite / flyers',
];

interface FormEvenement {
  nom: string;
  type: TypeEvenement;
  debut: string;
  fin: string;
  heure_arrivee: string;
  lieu: string;
  adresse: string;
  contact_nom: string;
  contact_telephone: string;
  contact_mail: string;
  formule: FormuleEvenement;
  prix_forfait: number | null;
  prix_gravure: number | null;
  nb_gravures: number | null;
  heures_sur_place: number | null;
  heures_trajet: number | null;
  forfait_carburant: number | null;
}

import { CodeDecoComponent, EasterComponent } from '../../../../../shared/ui/deco';

@Component({
  selector: 'app-evenement-detail-page',
  standalone: true,
  imports: [CodeDecoComponent, EasterComponent, CommonModule, FormsModule, RouterModule, HeaderComponent, SafeResourceUrlPipe, ClientPickerComponent],
  templateUrl: './evenement-detail-page.component.html',
  styleUrl: './evenement-detail-page.component.scss',
})
export class EvenementDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EvenementApiService);
  private readonly apiService = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = TYPES_EVENEMENT;
  readonly statuts = STATUTS_EVENEMENT;
  readonly formules = FORMULES_EVENEMENT;
  readonly tarifs = TARIFS_DIRECT;
  readonly euros = euros;
  readonly dateLongue = dateLongue;
  readonly dateCourte = dateCourte;
  readonly horaire = horaire;
  readonly typeEvenement = typeEvenement;
  readonly statutEvenement = statutEvenement;
  readonly nomClientEvenement = nomClientEvenement;
  readonly toneStatut = toneStatut;
  readonly nombre = nombre;
  readonly adresseUtile = adresseUtile;

  readonly evenement = signal<EvenementDetail | null>(null);
  readonly loading = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly action = signal<string | null>(null);

  // Modification des infos
  readonly edition = signal(false);
  readonly sauvegarde = signal(false);
  readonly editionErreur = signal<string | null>(null);
  form: FormEvenement = this.formVide();

  // Organisateur
  readonly choixOrganisateur = signal(false);

  // Notes
  readonly notes = signal('');
  readonly notesEtat = signal<'idle' | 'saving' | 'saved'>('idle');

  // Matériel
  readonly nouvelElement = signal('');

  // Commandes
  readonly rattachement = signal(false);
  readonly toutesCommandes = signal<Commande[] | null>(null);
  readonly rechercheCommande = signal('');

  readonly suppressionConfirm = signal(false);

  readonly id = computed(() => this.evenement()?.id_evenement ?? '');
  readonly calcul = computed(() => {
    const e = this.evenement();
    return e ? calculFormules(e) : null;
  });
  readonly materielFait = computed(() => (this.evenement()?.materiel ?? []).filter((m) => m.fait).length);
  readonly compteur = computed(() => {
    const e = this.evenement();
    if (!e || !aVenir(e)) return null;
    const j = joursAvant(e.date_debut);
    if (j === null) return null;
    if (j < 0) return 'En cours';
    if (j === 0) return "Aujourd'hui";
    if (j === 1) return 'Demain';
    return `Dans ${j} jours`;
  });

  readonly resultatsCommandes = computed(() => {
    const list = this.toutesCommandes() ?? [];
    const liees = new Set((this.evenement()?.commandes ?? []).map((c) => c.id_commande));
    const termes = this.normaliser(this.rechercheCommande()).split(/\s+/).filter(Boolean);
    return list
      .filter((c) => !liees.has(c.id_commande))
      .filter((c) => {
        if (termes.length === 0) return true;
        const texte = this.normaliser([c.produit, c.client?.nom, c.client?.prénom, c.client?.société].join(' '));
        return termes.every((t) => texte.includes(t));
      })
      .slice(0, 8);
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
      const id = p.get('id');
      if (id) this.charger(id);
    });
    this.realtime
      .on('evenement', 'commande')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ev) => {
        const id = this.id();
        if (!id || this.edition() || this.sauvegarde()) return;
        if (ev.resource === 'evenement' && ev.id && ev.id !== id) return;
        if (ev.resource === 'evenement' && ev.action === 'deleted') {
          this.router.navigate(['/dashboard', 'evenements']);
          return;
        }
        this.charger(id, false);
      });
  }

  charger(id: string, afficher = true): void {
    if (afficher) this.loading.set(true);
    this.api.detail(id).subscribe((e) => {
      this.loading.set(false);
      if (!e) {
        this.erreur.set("Impossible de charger l'événement.");
        return;
      }
      this.erreur.set(null);
      this.evenement.set(e);
      if (this.notesEtat() !== 'saving') this.notes.set(e.notes || '');
    });
  }

  // ---------- Enregistrement ----------
  private enregistrer(payload: EvenementPayload, cle: string, apres?: () => void): void {
    const id = this.id();
    if (!id) return;
    this.action.set(cle);
    this.api.modifier(id, payload).subscribe((e) => {
      this.action.set(null);
      if (!e) {
        this.erreur.set("La modification n'a pas pu être enregistrée.");
        return;
      }
      this.erreur.set(null);
      apres?.();
      this.charger(id, false);
    });
  }

  changerStatut(event: Event): void {
    this.enregistrer({ statut: (event.target as HTMLSelectElement).value as StatutEvenement }, 'statut');
  }

  basculerPaye(): void {
    const e = this.evenement();
    if (e) this.enregistrer({ paye: !e.paye }, 'paye');
  }

  /** Compteur de gravures, pratique pendant l'événement. */
  ajusterGravures(delta: number): void {
    const e = this.evenement();
    if (!e) return;
    const n = Math.max(0, (e.nb_gravures || 0) + delta);
    this.evenement.set({ ...e, nb_gravures: n });
    this.enregistrer({ nb_gravures: n }, 'gravures');
  }

  appliquerFormule(formule: 'a_la_gravure' | 'illimite'): void {
    const c = this.calcul();
    if (!c) return;
    if (formule === 'illimite') this.enregistrer({ formule, prix_forfait: c.illimite }, 'formule');
    else this.enregistrer({ formule, prix_forfait: c.alaGravure, prix_gravure: TARIFS_DIRECT.prixGravure }, 'formule');
  }

  // ---------- Infos ----------
  commencerEdition(): void {
    const e = this.evenement();
    if (!e) return;
    this.form = {
      nom: e.nom,
      type: e.type,
      debut: versChampDate(e.date_debut),
      fin: versChampDate(e.date_fin),
      heure_arrivee: e.heure_arrivee || '',
      lieu: e.lieu || '',
      adresse: e.adresse || '',
      contact_nom: e.contact_nom || '',
      contact_telephone: e.contact_telephone || '',
      contact_mail: e.contact_mail || '',
      formule: e.formule,
      prix_forfait: nombre(e.prix_forfait),
      prix_gravure: nombre(e.prix_gravure),
      nb_gravures: e.nb_gravures,
      heures_sur_place: nombre(e.heures_sur_place),
      heures_trajet: nombre(e.heures_trajet),
      forfait_carburant: nombre(e.forfait_carburant),
    };
    this.editionErreur.set(null);
    this.edition.set(true);
  }

  annulerEdition(): void {
    this.edition.set(false);
  }

  /** Fin par défaut : même jour que le début quand on ne saisit que l'heure de début. */
  onDebutChange(): void {
    if (this.form.debut && !this.form.fin) {
      const d = new Date(this.form.debut);
      if (!isNaN(d.getTime())) {
        d.setHours(d.getHours() + 3);
        this.form.fin = versChampDate(d.toISOString());
      }
    }
  }

  enregistrerEdition(): void {
    const f = this.form;
    if (!f.nom.trim()) {
      this.editionErreur.set("Donne un nom à l'événement.");
      return;
    }
    const debut = depuisChampDate(f.debut);
    const fin = depuisChampDate(f.fin);
    if (debut && fin && new Date(fin) < new Date(debut)) {
      this.editionErreur.set('La fin est avant le début.');
      return;
    }
    const num = (v: number | null) => (v === null || (v as unknown) === '' || !isFinite(Number(v)) ? null : Number(v));
    this.sauvegarde.set(true);
    this.api
      .modifier(this.id(), {
        nom: f.nom.trim(),
        type: f.type,
        date_debut: debut,
        date_fin: fin,
        heure_arrivee: f.heure_arrivee,
        lieu: f.lieu,
        adresse: f.adresse,
        contact_nom: f.contact_nom,
        contact_telephone: f.contact_telephone,
        contact_mail: f.contact_mail,
        formule: f.formule,
        prix_forfait: num(f.prix_forfait),
        prix_gravure: num(f.prix_gravure),
        nb_gravures: num(f.nb_gravures),
        heures_sur_place: num(f.heures_sur_place),
        heures_trajet: num(f.heures_trajet),
        forfait_carburant: num(f.forfait_carburant),
      })
      .subscribe((e) => {
        this.sauvegarde.set(false);
        if (!e) {
          this.editionErreur.set("L'événement n'a pas pu être enregistré.");
          return;
        }
        this.edition.set(false);
        this.charger(this.id(), false);
      });
  }

  choisirOrganisateur(client: FicheClient): void {
    this.choixOrganisateur.set(false);
    this.enregistrer({ id_client: client.id_client }, 'organisateur');
  }

  retirerOrganisateur(): void {
    this.enregistrer({ id_client: null }, 'organisateur');
  }

  // ---------- Notes ----------
  setNotes(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
    this.notesEtat.set('idle');
  }

  notesModifiees(): boolean {
    return (this.evenement()?.notes || '') !== this.notes();
  }

  enregistrerNotes(): void {
    if (!this.notesModifiees()) return;
    this.notesEtat.set('saving');
    this.api.modifier(this.id(), { notes: this.notes() }).subscribe((e) => {
      this.notesEtat.set(e ? 'saved' : 'idle');
      if (e) this.evenement.update((ev) => (ev ? { ...ev, notes: e.notes } : ev));
      else this.erreur.set("Les notes n'ont pas pu être enregistrées.");
    });
  }

  // ---------- Matériel ----------
  private enregistrerMateriel(materiel: ElementMateriel[]): void {
    this.evenement.update((e) => (e ? { ...e, materiel } : e));
    this.enregistrer({ materiel }, 'materiel');
  }

  basculerElement(index: number): void {
    const list = [...(this.evenement()?.materiel ?? [])];
    if (!list[index]) return;
    list[index] = { ...list[index], fait: !list[index].fait };
    this.enregistrerMateriel(list);
  }

  retirerElement(index: number): void {
    const list = (this.evenement()?.materiel ?? []).filter((_, i) => i !== index);
    this.enregistrerMateriel(list);
  }

  ajouterElement(): void {
    const texte = this.nouvelElement().trim();
    if (!texte) return;
    this.nouvelElement.set('');
    this.enregistrerMateriel([...(this.evenement()?.materiel ?? []), { texte, fait: false }]);
  }

  ajouterListeType(): void {
    const actuels = new Set((this.evenement()?.materiel ?? []).map((m) => m.texte.toLowerCase()));
    const ajouts = MATERIEL_TYPE.filter((t) => !actuels.has(t.toLowerCase())).map((texte) => ({ texte, fait: false }));
    this.enregistrerMateriel([...(this.evenement()?.materiel ?? []), ...ajouts]);
  }

  toutDecocher(): void {
    this.enregistrerMateriel((this.evenement()?.materiel ?? []).map((m) => ({ ...m, fait: false })));
  }

  // ---------- Commandes ----------
  ouvrirRattachement(): void {
    this.rechercheCommande.set('');
    this.rattachement.set(true);
    this.apiService.get(ApiURI.LISTE_COMMANDES).subscribe((r) => {
      const list = r.result && r.data ? (r.data as Commande[]) : [];
      list.sort((a, b) => String(b.date_commande || '').localeCompare(String(a.date_commande || '')));
      this.toutesCommandes.set(list);
    });
  }

  setRechercheCommande(event: Event): void {
    this.rechercheCommande.set((event.target as HTMLInputElement).value);
  }

  titreCommande(c: Commande): string {
    return getCommandeSiteDisplayTitle(c) || c.produit || 'Commande';
  }

  clientCommande(c: Commande): string {
    const cl = c.client;
    if (!cl) return '';
    return [cl.prénom, cl.nom].filter((v) => v && String(v).trim()).join(' ') || cl.société || '';
  }

  rattacher(c: Commande): void {
    this.action.set('lier-' + c.id_commande);
    this.api.lierCommande(this.id(), c.id_commande).subscribe((ok) => {
      this.action.set(null);
      if (!ok) {
        this.erreur.set("La commande n'a pas pu être rattachée.");
        return;
      }
      this.charger(this.id(), false);
    });
  }

  detacher(c: CommandeEvenement, event: Event): void {
    event.stopPropagation();
    this.action.set('delier-' + c.id_commande);
    this.api.delierCommande(this.id(), c.id_commande).subscribe((ok) => {
      this.action.set(null);
      if (ok) this.charger(this.id(), false);
      else this.erreur.set("La commande n'a pas pu être détachée.");
    });
  }

  ouvrirCommande(c: CommandeEvenement): void {
    this.router.navigate(['/dashboard', 'commandes', 'detail', c.id_commande]);
  }

  nouvelleCommande(): void {
    this.router.navigate(['/dashboard', 'commandes', 'nouvelle'], { queryParams: { evenement: this.id() } });
  }

  libelleStatut(c: CommandeEvenement): string {
    return STATUT_LABELS[c.statut_commande as StatutCommande] ?? c.statut_commande;
  }

  // ---------- Suppression ----------
  supprimer(): void {
    if (!this.suppressionConfirm()) {
      this.suppressionConfirm.set(true);
      return;
    }
    this.api.supprimer(this.id()).subscribe((ok) => {
      if (ok) this.router.navigate(['/dashboard', 'evenements']);
      else this.erreur.set("L'événement n'a pas pu être supprimé.");
    });
  }

  // ---------- Affichage ----------
  jour(): string {
    const d = this.evenement()?.date_debut;
    return d ? String(new Date(d).getDate()) : '?';
  }

  mois(): string {
    const d = this.evenement()?.date_debut;
    return d ? new Date(d).toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '') : '';
  }

  libelleFormule(f: FormuleEvenement): string {
    return FORMULES_EVENEMENT.find((x) => x.valeur === f)?.label ?? f;
  }

  mapsUrl(adresse: string): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adresse);
  }

  mapEmbedUrl(adresse: string): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(adresse)}&z=15&output=embed`;
  }

  telUrl(tel: string): string {
    return 'tel:' + tel.replace(/[^\d+]/g, '');
  }

  private normaliser(v: string): string {
    return (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  private formVide(): FormEvenement {
    return {
      nom: '', type: 'gravure_direct', debut: '', fin: '', heure_arrivee: '', lieu: '', adresse: '',
      contact_nom: '', contact_telephone: '', contact_mail: '', formule: 'a_definir',
      prix_forfait: null, prix_gravure: null, nb_gravures: null, heures_sur_place: null, heures_trajet: null, forfait_carburant: null,
    };
  }
}
