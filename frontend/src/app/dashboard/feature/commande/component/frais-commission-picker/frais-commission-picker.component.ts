import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { FloatingLabelInputComponent } from '@shared';
import {
  FraisCommission,
  FRAIS_COMMISSION_LIBRE,
  FRAIS_COMMISSION_NOUVEAU,
} from '../../model/frais-commission.interface';

@Component({
  selector: 'app-frais-commission-picker',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FloatingLabelInputComponent],
  templateUrl: './frais-commission-picker.component.html',
  styleUrl: './frais-commission-picker.component.scss',
})
export class FraisCommissionPickerComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) formGroup!: FormGroup;
  @Input({ required: true }) selectionControl!: FormControl<string | null>;
  @Input({ required: true }) idControl!: FormControl<string | null>;
  @Input({ required: true }) libelleControl!: FormControl<string | null>;
  @Input({ required: true }) pourcentageControl!: FormControl<number | null>;
  @Input() disabled = false;
  @Input() readonly = false;

  readonly FRAIS_COMMISSION_LIBRE = FRAIS_COMMISSION_LIBRE;
  readonly FRAIS_COMMISSION_NOUVEAU = FRAIS_COMMISSION_NOUVEAU;

  fraisCommissions: WritableSignal<FraisCommission[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  createError: WritableSignal<string | null> = signal(null);
  isSavingPreset = false;
  selectFocus = false;

  nouveauLibelleControl = new FormControl<string>('');
  nouveauPourcentageControl = new FormControl<number | null>(null);

  private readonly apiService = inject(ApiService);
  private readonly subscriptions: Subscription[] = [];
  private isSyncing = false;

  ngOnInit(): void {
    this.loadFraisCommissions();
    this.bindControlSubscriptions();
    this.syncSelectionFromValues();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['selectionControl'] ||
      changes['idControl'] ||
      changes['libelleControl'] ||
      changes['pourcentageControl']
    ) {
      if (!changes['selectionControl']?.firstChange) {
        this.bindControlSubscriptions();
        this.syncSelectionFromValues();
      }
    }
  }

  ngOnDestroy(): void {
    this.clearSubscriptions();
  }

  loadFraisCommissions(): void {
    this.isLoading.set(true);
    this.apiService.get(ApiURI.LISTE_FRAIS_COMMISSIONS).subscribe({
      next: (response) => {
        this.fraisCommissions.set((response.data as FraisCommission[]) || []);
        this.isLoading.set(false);
        this.syncSelectionFromValues();
      },
      error: () => {
        this.isLoading.set(false);
        this.syncSelectionFromValues();
      },
    });
  }

  onSelectionChange(): void {
    if (this.isSyncing || this.disabled || this.readonly) return;

    const selection = this.selectionControl.value;
    if (!selection) {
      this.idControl.setValue(null, { emitEvent: false });
      this.libelleControl.setValue(null, { emitEvent: false });
      this.pourcentageControl.setValue(null, { emitEvent: false });
      return;
    }

    if (selection === FRAIS_COMMISSION_LIBRE || selection === FRAIS_COMMISSION_NOUVEAU) {
      this.idControl.setValue(null, { emitEvent: false });
      if (selection === FRAIS_COMMISSION_NOUVEAU) {
        this.nouveauLibelleControl.setValue('', { emitEvent: false });
        this.nouveauPourcentageControl.setValue(null, { emitEvent: false });
      }
      return;
    }

    const preset = this.fraisCommissions().find((item) => item.id_frais_commission === selection);
    if (!preset) return;

    this.isSyncing = true;
    this.idControl.setValue(preset.id_frais_commission, { emitEvent: false });
    this.libelleControl.setValue(preset.libelle, { emitEvent: false });
    this.pourcentageControl.setValue(Number(preset.pourcentage), { emitEvent: false });
    this.isSyncing = false;
  }

  saveNewPreset(): void {
    if (this.disabled || this.readonly || this.isSavingPreset) return;

    const libelle = (this.nouveauLibelleControl.value || '').trim();
    const pourcentageRaw = this.nouveauPourcentageControl.value;
    const pourcentage = pourcentageRaw !== null && pourcentageRaw !== undefined
      ? Number(pourcentageRaw)
      : NaN;

    if (!libelle) {
      this.createError.set('Indiquez un libellé pour le frais / commission.');
      return;
    }
    if (Number.isNaN(pourcentage) || pourcentage < 0 || pourcentage > 100) {
      this.createError.set('Indiquez un pourcentage valide entre 0 et 100.');
      return;
    }

    this.createError.set(null);
    this.isSavingPreset = true;

    this.apiService.post(ApiURI.AJOUTER_FRAIS_COMMISSION, {
      libelle,
      pourcentage,
    }).subscribe({
      next: (response) => {
        const created = response.data as FraisCommission;
        this.isSavingPreset = false;
        if (!created?.id_frais_commission) {
          this.createError.set('Impossible d\'enregistrer le frais / commission.');
          return;
        }

        const updatedList = [...this.fraisCommissions(), created]
          .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
        this.fraisCommissions.set(updatedList);

        this.isSyncing = true;
        this.selectionControl.setValue(created.id_frais_commission, { emitEvent: false });
        this.idControl.setValue(created.id_frais_commission, { emitEvent: false });
        this.libelleControl.setValue(created.libelle, { emitEvent: false });
        this.pourcentageControl.setValue(Number(created.pourcentage), { emitEvent: false });
        this.isSyncing = false;
      },
      error: () => {
        this.isSavingPreset = false;
        this.createError.set('Impossible d\'enregistrer le frais / commission.');
      },
    });
  }

  getDisplayLabel(): string {
    const libelle = this.libelleControl.value;
    const pourcentage = this.pourcentageControl.value;
    if (!libelle && (pourcentage === null || pourcentage === undefined || pourcentage === '' as any)) {
      return '-';
    }
    const pct = pourcentage !== null && pourcentage !== undefined ? `${pourcentage} %` : '';
    if (libelle && pct) return `${libelle} (${pct})`;
    return libelle || pct || '-';
  }

  formatPresetLabel(item: FraisCommission): string {
    return `${item.libelle} (${item.pourcentage} %)`;
  }

  isLibreMode(): boolean {
    return this.selectionControl.value === FRAIS_COMMISSION_LIBRE;
  }

  isNouveauMode(): boolean {
    return this.selectionControl.value === FRAIS_COMMISSION_NOUVEAU;
  }

  hasSelectionValue(): boolean {
    const value = this.selectionControl.value;
    return value !== null && value !== undefined && String(value).length > 0;
  }

  private bindControlSubscriptions(): void {
    this.clearSubscriptions();
    this.subscriptions.push(
      this.selectionControl.valueChanges.subscribe(() => this.onSelectionChange()),
      this.idControl.valueChanges.subscribe(() => this.syncSelectionFromValues()),
      this.libelleControl.valueChanges.subscribe(() => this.syncSelectionFromValues()),
      this.pourcentageControl.valueChanges.subscribe(() => this.syncSelectionFromValues()),
    );
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions.length = 0;
  }

  private syncSelectionFromValues(): void {
    if (this.isSyncing) return;

    const currentSelection = this.selectionControl.value;
    if (currentSelection === FRAIS_COMMISSION_LIBRE || currentSelection === FRAIS_COMMISSION_NOUVEAU) {
      return;
    }

    const id = this.idControl.value;
    if (id) {
      const preset = this.fraisCommissions().find((item) => item.id_frais_commission === id);
      if (preset) {
        this.isSyncing = true;
        this.selectionControl.setValue(id, { emitEvent: false });
        if (!this.libelleControl.value) {
          this.libelleControl.setValue(preset.libelle, { emitEvent: false });
        }
        if (this.pourcentageControl.value === null || this.pourcentageControl.value === undefined) {
          this.pourcentageControl.setValue(Number(preset.pourcentage), { emitEvent: false });
        }
        this.isSyncing = false;
        return;
      }

      if (currentSelection === id || this.fraisCommissions().length === 0) {
        this.isSyncing = true;
        this.selectionControl.setValue(id, { emitEvent: false });
        this.isSyncing = false;
        return;
      }
    }

    const libelle = this.libelleControl.value;
    const pourcentage = this.pourcentageControl.value;
    if (libelle || (pourcentage !== null && pourcentage !== undefined)) {
      const preset = this.fraisCommissions().find((item) =>
        item.libelle === libelle && Number(item.pourcentage) === Number(pourcentage)
      );
      this.isSyncing = true;
      this.selectionControl.setValue(preset ? preset.id_frais_commission : FRAIS_COMMISSION_LIBRE, { emitEvent: false });
      if (preset) {
        this.idControl.setValue(preset.id_frais_commission, { emitEvent: false });
      } else {
        this.idControl.setValue(null, { emitEvent: false });
      }
      this.isSyncing = false;
    }
  }
}
