import { Component, OnInit, computed, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HeaderComponent } from '@shared';
import { Bon, DureeValidite } from '../../model/bon.interface';
import { BonService } from '../../service/bon.service';

interface BonFormValue {
  numero: string;
  intitule: string;
  date_creation: string;
  valeur?: number | null;
  nom?: string | null;
  prenom?: string | null;
  modeEcheance: 'duree' | 'date';
  duree_validite?: DureeValidite | null;
  date_echeance?: string | null;
}

@Component({
  selector: 'app-bons-cadeaux-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent],
  templateUrl: './bons-cadeaux-page.component.html',
  styleUrl: './bons-cadeaux-page.component.scss',
})
export class BonsCadeauxPageComponent implements OnInit {
  private readonly fb: FormBuilder = inject(FormBuilder);
  private readonly bonService: BonService = inject(BonService);

  form!: FormGroup;
  isCreating: WritableSignal<boolean> = signal(false);
  editingBonId: WritableSignal<string | null> = signal(null);
  deleteConfirmBon: WritableSignal<Bon | null> = signal(null);
  isLoading: WritableSignal<boolean> = signal(true);
  submitError: WritableSignal<string | null> = signal(null);

  bonsActifs = computed<Bon[]>(() =>
    this.bonService.bons().filter((b: Bon) => !b.utilise && !this.isExpired(b))
  );
  bonsExpires = computed<Bon[]>(() =>
    this.bonService.bons().filter((b: Bon) => !b.utilise && this.isExpired(b))
  );
  bonsTermines = computed<Bon[]>(() => this.bonService.bons().filter((b: Bon) => b.utilise));

  /** Sections repliables : actifs affiché par défaut, expirés et terminés cachés */
  showActifs: WritableSignal<boolean> = signal(true);
  showExpires: WritableSignal<boolean> = signal(false);
  showTermines: WritableSignal<boolean> = signal(false);

  toggleSection(section: 'actifs' | 'expires' | 'termines'): void {
    if (section === 'actifs') this.showActifs.update((v) => !v);
    else if (section === 'expires') this.showExpires.update((v) => !v);
    else this.showTermines.update((v) => !v);
  }

  private isExpired(bon: Bon): boolean {
    return BonService.isExpired(bon);
  }

  readonly durees: { value: DureeValidite; label: string }[] = [
    { value: '1M', label: '1 mois' },
    { value: '2M', label: '2 mois' },
    { value: '3M', label: '3 mois' },
    { value: '6M', label: '6 mois' },
    { value: '1Y', label: '1 an' },
    { value: 'LIFE', label: 'À vie' },
  ];

  ngOnInit(): void {
    this.bonService.loadBons();
    this.isLoading.set(false);
  }

  private createForm(numero = 'BG001'): FormGroup {
    const today = new Date().toISOString().split('T')[0];
    return this.fb.group({
      numero: this.fb.control(numero, [Validators.required]),
      intitule: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
      date_creation: this.fb.control(today, [Validators.required]),
      valeur: this.fb.control<number | null>(null),
      nom: this.fb.control<string | null>(null),
      prenom: this.fb.control<string | null>(null),
      modeEcheance: this.fb.control<'duree' | 'date'>('duree'),
      duree_validite: this.fb.control<DureeValidite | null>('1M'),
      date_echeance: this.fb.control<string | null>(null),
    });
  }

  get typedForm(): FormGroup {
    return this.form;
  }

  get isInCreateOrEditMode(): boolean {
    return this.isCreating() || this.editingBonId() != null;
  }

  /** Date d'échéance calculée pour la prévisualisation (mode durée) */
  get dateEcheancePreview(): string | null {
    const form = this.typedForm;
    if (!form) return null;
    const mode = form.get('modeEcheance')?.value;
    if (mode !== 'duree') return null;
    const dateCreation = form.get('date_creation')?.value;
    const duree = form.get('duree_validite')?.value;
    return BonService.computeDateEcheance(dateCreation, duree, null);
  }

  openCreateForm(): void {
    this.editingBonId.set(null);
    this.isCreating.set(true);
    this.submitError.set(null);
    this.form = this.createForm('BG001');
    this.bonService.getNextNumero((numero: string) => {
      this.form?.patchValue({ numero });
    });
  }

  cancelCreate(): void {
    this.isCreating.set(false);
    this.editingBonId.set(null);
    this.submitError.set(null);
  }

  openEditForm(bon: Bon): void {
    this.isCreating.set(false);
    this.editingBonId.set(bon.id_bon);
    this.submitError.set(null);
    const dc = bon.date_creation ? new Date(bon.date_creation).toISOString().split('T')[0] : '';
    const de = bon.date_echeance ? new Date(bon.date_echeance).toISOString().split('T')[0] : null;
    const mode: 'duree' | 'date' = bon.duree_validite ? 'duree' : 'date';
    this.form = this.fb.group({
      numero: this.fb.control(bon.numero, [Validators.required]),
      intitule: this.fb.control(bon.intitule, [Validators.required, Validators.maxLength(200)]),
      date_creation: this.fb.control(dc, [Validators.required]),
      valeur: this.fb.control<number | null>(bon.valeur ?? null),
      nom: this.fb.control<string | null>(bon.nom ?? null),
      prenom: this.fb.control<string | null>(bon.prenom ?? null),
      modeEcheance: this.fb.control<'duree' | 'date'>(mode),
      duree_validite: this.fb.control<DureeValidite | null>(bon.duree_validite ?? '1M'),
      date_echeance: this.fb.control<string | null>(de),
    });
  }

  cancelEdit(): void {
    this.editingBonId.set(null);
    this.submitError.set(null);
  }

  isEditing(bon: Bon): boolean {
    return this.editingBonId() === bon.id_bon;
  }

  submit(): void {
    const form = this.typedForm;
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    this.submitError.set(null);
    const raw = form.value as BonFormValue;
    const dateCreation = raw.date_creation;
    let duree: DureeValidite | null | undefined = null;
    let dateManuelle: string | null | undefined = null;

    if (raw.modeEcheance === 'duree') {
      duree = raw.duree_validite ?? null;
    } else {
      dateManuelle = raw.date_echeance || null;
    }

    const dateEcheance = BonService.computeDateEcheance(dateCreation, duree, dateManuelle);

    const val = raw.valeur;
    const valeur = (val != null && String(val).trim() !== '') ? Number(val) : null;

    const editingId = this.editingBonId();
    if (editingId) {
      const payload: Partial<Bon> & { id_bon: string } = {
        id_bon: editingId,
        numero: raw.numero,
        intitule: raw.intitule,
        date_creation: dateCreation,
        valeur,
        nom: raw.nom || null,
        prenom: raw.prenom || null,
        duree_validite: raw.modeEcheance === 'duree' ? duree ?? null : null,
        date_echeance: dateEcheance,
      };
      this.bonService.updateBon(payload, () => {
        this.editingBonId.set(null);
      }, () => {
        this.submitError.set('Erreur lors de la modification du bon. Veuillez réessayer.');
      });
    } else {
      const payload: Omit<Bon, 'id_bon'> = {
        numero: raw.numero,
        intitule: raw.intitule,
        date_creation: dateCreation,
        valeur,
        nom: raw.nom || null,
        prenom: raw.prenom || null,
        duree_validite: raw.modeEcheance === 'duree' ? duree ?? null : null,
        date_echeance: dateEcheance,
        utilise: false,
      };
      this.bonService.addBon(payload, () => {
        this.isCreating.set(false);
      }, () => {
        this.submitError.set('Erreur lors de la création du bon. Veuillez réessayer.');
      });
    }
  }

  openDeleteConfirm(bon: Bon): void {
    this.deleteConfirmBon.set(bon);
  }

  cancelDelete(): void {
    this.deleteConfirmBon.set(null);
  }

  confirmDelete(): void {
    const bon = this.deleteConfirmBon();
    if (!bon) return;
    this.bonService.deleteBon(bon.id_bon, () => {
      this.deleteConfirmBon.set(null);
    }, () => {
      this.submitError.set('Erreur lors de la suppression du bon.');
    });
  }

  onUtiliseChange(bon: Bon, checked: boolean): void {
    this.bonService.setUtilise(bon.id_bon, checked);
  }

  formatValeur(v: number | null | undefined): string {
    if (v == null || v === undefined) return '—';
    const n = Number(v);
    return Number.isNaN(n) ? '—' : `${n.toFixed(2)} €`;
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
