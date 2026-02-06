import { Component, OnInit, OnDestroy, AfterViewChecked, AfterViewInit, inject, signal, WritableSignal, ViewChild, ElementRef } from '@angular/core';
import { FormControl, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent, FloatingLabelInputComponent, getFormValidationErrors, FormError } from '@shared';
import { ApiService } from '@api';
import { ApiURI, COMMANDE_FICHIERS_UPLOAD } from '@api';
import { forkJoin } from 'rxjs';
import { NouvelleCommandeForm, CoordonneesContactForm } from '../../data/form/nouvelle-commande.form';
import { Couleur, StatutCommande, ModeContact } from '../../model/commande.interface';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-nouvelle-commande-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent],
  templateUrl: './nouvelle-commande-page.component.html',
  styleUrl: './nouvelle-commande-page.component.scss'
})
export class NouvelleCommandePageComponent implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit {
  formGroup!: FormGroup;
  errors: WritableSignal<FormError[]> = signal([]);
  submitted = false;
  showSuccessPopup: WritableSignal<boolean> = signal(false);
  uploadedFiles: File[] = [];
  supportInputFocus: boolean = false;
  isDragOver: boolean = false;
  private scrollRestored: boolean = false;
  showPrixFields: WritableSignal<boolean> = signal(false);
  isVente: WritableSignal<boolean> = signal(false);
  private readonly ventePrefix = 'Vente | ';
  private isAdjustingNom = false;
  private lastNonVenteStatut: StatutCommande = StatutCommande.EN_ATTENTE_INFORMATION;
  @ViewChild('supportInput', { read: ElementRef }) supportInputRef?: ElementRef<HTMLElement>;
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly scrollKey = 'nouvelle-commande-scroll';
  private readonly clearScrollKey = 'nouvelle-commande-clear-scroll';

  // Options disponibles
  couleursDisponibles: Couleur[] = [
    Couleur.NOIR,
    Couleur.NATUREL,
    Couleur.LASURE,
    Couleur.OR,
    Couleur.ARGENT,
    Couleur.BLANC,
    Couleur.GRAVURE_PEINTE
  ];
  
  supportParDefaut: string = 'CP 3,6mm Méranti';

  // Exposer StatutCommande pour l'utiliser dans le template
  readonly StatutCommande = StatutCommande;

  // Statuts normaux (sans ANNULEE pour le workflow normal)
  readonly statuts: StatutCommande[] = [
    StatutCommande.EN_ATTENTE_INFORMATION,
    StatutCommande.A_MODELLISER_PREPARER,
    StatutCommande.A_GRAVER,
    StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
    StatutCommande.A_PRENDRE_EN_PHOTO,
    StatutCommande.A_LIVRER,
    StatutCommande.A_METTRE_EN_LIGNE,
    StatutCommande.A_FACTURER,
    StatutCommande.DEMANDE_AVIS,
  ];

  // Tous les statuts incluant ANNULEE pour l'affichage dans le détail
  readonly allStatuts: StatutCommande[] = [
    ...this.statuts,
    StatutCommande.ANNULEE,
  ];

  readonly statutLabels: Record<StatutCommande, string> = {
    [StatutCommande.EN_ATTENTE_INFORMATION]: 'Attente',
    [StatutCommande.A_MODELLISER_PREPARER]: 'Modélisation',
    [StatutCommande.A_GRAVER]: 'Gravure',
    [StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE]: 'Finition',
    [StatutCommande.A_PRENDRE_EN_PHOTO]: 'Photo',
    [StatutCommande.A_LIVRER]: 'Livraison',
    [StatutCommande.A_METTRE_EN_LIGNE]: 'WEB',
    [StatutCommande.A_FACTURER]: 'Facturation',
    [StatutCommande.DEMANDE_AVIS]: 'Avis',
    [StatutCommande.TERMINE]: 'Terminé',
    [StatutCommande.ANNULEE]: 'Annulée',
  };

  // Statut initial sélectionné (pour nouvelle commande, EN_ATTENTE_INFORMATION par défaut)
  get statutInitial(): StatutCommande | null {
    return this.formGroup?.get('statut_initial')?.value || StatutCommande.EN_ATTENTE_INFORMATION;
  }

  // Modes de contact disponibles
  readonly modesContact = [
    { value: ModeContact.MAIL, label: 'Mail', emoji: '📧' },
    { value: ModeContact.TEL, label: 'Téléphone', emoji: '📞' },
    { value: ModeContact.META, label: 'Meta', emoji: '💬' }
  ];


  constructor(private router: Router) {
    this.initFormGroup();
  }

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.saveScrollPosition);
    // Arrivée depuis le dashboard : ne pas restaurer le scroll (éviter le scroll forcé en bas)
    try {
      if (sessionStorage.getItem(this.clearScrollKey) === '1') {
        sessionStorage.removeItem(this.clearScrollKey);
        sessionStorage.removeItem(this.scrollKey);
        this.scrollRestored = true;
      }
    } catch {}
    this.formGroup.get('coordonnees_contact.pays')?.setValue('Belgique');
  }

  ngAfterViewChecked(): void {
    if (this.scrollRestored) return;
    const savedScroll = sessionStorage.getItem(this.scrollKey);
    if (savedScroll) {
      this.restoreScrollPosition(parseInt(savedScroll, 10));
    }
  }

  private restoreScrollPosition(scrollPosition: number): void {
    // Méthode robuste compatible Safari avec plusieurs tentatives
    const attemptScroll = (attempts: number = 0) => {
      if (attempts > 10) {
        // Arrêter après 10 tentatives
        this.scrollRestored = true;
        return;
      }

      requestAnimationFrame(() => {
        // Vérifier que le document est prêt
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          // Essayer différentes méthodes de scroll pour compatibilité Safari
          window.scrollTo(0, scrollPosition);
          document.documentElement.scrollTop = scrollPosition;
          document.body.scrollTop = scrollPosition;

          // Vérifier si le scroll a fonctionné (avec une marge d'erreur de 5px)
          const currentScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          if (Math.abs(currentScroll - scrollPosition) <= 5) {
            this.scrollRestored = true;
          } else {
            // Réessayer après un court délai
            setTimeout(() => attemptScroll(attempts + 1), 50);
          }
        } else {
          // Attendre que le document soit prêt
          setTimeout(() => attemptScroll(attempts + 1), 50);
        }
      });
    };

    // Commencer la restauration après un court délai initial
    setTimeout(() => attemptScroll(), 100);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.saveScrollPosition);
    this.filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    this.filePreviewUrls.clear();
  }

  private saveScrollPosition = (): void => {
    sessionStorage.setItem(this.scrollKey, window.scrollY.toString());
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }


  private validationMessage(key: string, value: any): string | null {
    if (key === 'required') return 'Ce champ est requis';
    if (key === 'minlength') return `Minimum ${value?.requiredLength ?? 0} caractères`;
    if (key === 'maxlength') return `Maximum ${value?.requiredLength ?? 0} caractères`;
    if (key === 'min') return `Minimum ${value?.min ?? 0}`;
    if (key === 'email') return 'Adresse email invalide';
    return null;
  }

  getControlByPath(path: string): FormControl<any> | null {
    const c = this.formGroup.get(path);
    return c instanceof FormControl ? c : null;
  }

  getFieldErrorMessage(controlPath: string): string | null {
    const control = this.getControlByPath(controlPath);
    if (!control) return null;
    const serverError = this.errors().find((e) => e.control === controlPath);
    if (serverError && !['required', 'minlength', 'maxlength', 'min', 'email'].includes(serverError.error)) return serverError.error;
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    const err = control.errors;
    if (!err) return null;
    const key = Object.keys(err)[0];
    return this.validationMessage(key, err[key]) ?? 'Champ invalide';
  }

  hasFieldError(controlPath: string): boolean {
    return this.getFieldErrorMessage(controlPath) != null;
  }

  private getAllFormErrors(): FormError[] {
    return getFormValidationErrors(this.formGroup);
  }

  getGeneralError(): string | null {
    const err = this.errors().find((e) => e.control === 'commande');
    return err ? err.error : null;
  }

  private initFormGroup(): void {
    // Créer un FormArray pour les supports avec un support vide par défaut
    const supportsArray = new FormArray<FormGroup>([]);
    supportsArray.push(this.createSupportFormGroup({}));

    this.formGroup = new FormGroup({
      nom_commande: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]),
      deadline: new FormControl<string>('', []),
      description_projet: new FormControl<string>(''),
      dimensions_souhaitees: new FormControl<string>(''),
      support: new FormControl<string>('', []),
      police_ecriture: new FormControl<string>(''),
      texte_personnalisation: new FormControl<string>(''),
      couleur: new FormControl<string[]>([]),
      quantité: new FormControl<number>(1, [Validators.min(1)]),
      prix_unitaire_final: new FormControl<number | null>(null),
      prix_final: new FormControl<number | null>(null),
      payé: new FormControl<boolean>(false),
      commentaire_paye: new FormControl<string>(''),
      attente_reponse: new FormControl<boolean>(false),
      supports: supportsArray,
      prix_final_supports_unitaires: new FormControl({ value: 0, disabled: true }),
      prix_final_supports: new FormControl({ value: 0, disabled: true }),
      prix_benefice: new FormControl({ value: 0, disabled: true }),
      // Coordonnées contact (champs individuels)
      nom: new FormControl<string>('', [Validators.maxLength(50)]),
      prenom: new FormControl<string>('', [Validators.maxLength(50)]),
      telephone: new FormControl<string>('', [Validators.maxLength(15)]),
      mail: new FormControl<string>('', [Validators.email]),
      rue: new FormControl<string>('', [Validators.maxLength(100)]),
      code_postal: new FormControl<string>('', [Validators.maxLength(10)]),
      ville: new FormControl<string>('', [Validators.maxLength(50)]),
      pays: new FormControl<string>('Belgique', [Validators.maxLength(50)]),
      tva: new FormControl<string>('', [Validators.maxLength(20)]),
      mode_contact: new FormControl<string>(''),
      statut_initial: new FormControl<StatutCommande | null>(StatutCommande.EN_ATTENTE_INFORMATION)
    });

    const nomControl = this.formGroup.get('nom_commande');
    nomControl?.valueChanges.subscribe((value) => {
      if (!this.isVente() || this.isAdjustingNom) return;
      const normalized = this.ensureVentePrefix(value || '');
      if (normalized !== (value || '')) {
        this.isAdjustingNom = true;
        nomControl.setValue(normalized, { emitEvent: false });
        this.isAdjustingNom = false;
      }
    });

    // Écouter les changements pour recalculer automatiquement
    let isCalculatingPF = false;
    let isCalculatingPU = false;
    
    this.formGroup.get('quantité')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      const prixFinal = this.formGroup.get('prix_final')?.value;
      const prixUnitaire = this.formGroup.get('prix_unitaire_final')?.value;
      if (prixFinal) {
        isCalculatingPU = true;
        this.recalculatePrixUnitaireFromFinal();
        isCalculatingPU = false;
      } else if (prixUnitaire) {
        isCalculatingPF = true;
        this.recalculatePrixFinalFromUnitaire();
        isCalculatingPF = false;
      }
      this.recalculateSupportsAndBenefice();
    });
    
    this.formGroup.get('prix_final')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      isCalculatingPU = true;
      this.recalculatePrixUnitaireFromFinal();
      isCalculatingPU = false;
      this.recalculateSupportsAndBenefice();
    });
    
    this.formGroup.get('prix_unitaire_final')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      isCalculatingPF = true;
      this.recalculatePrixFinalFromUnitaire();
      isCalculatingPF = false;
      this.recalculateSupportsAndBenefice();
    });

  }

  ngAfterViewInit(): void {
    // Ajouter un listener focus sur l'input support après l'initialisation de la vue
    setTimeout(() => {
      if (this.supportInputRef?.nativeElement) {
        const input = this.supportInputRef.nativeElement.querySelector('input') as HTMLInputElement;
        if (input) {
          input.addEventListener('focus', () => {
            const supportControl = this.formGroup.get('support');
            if (supportControl && supportControl.value === this.supportParDefaut) {
              supportControl.setValue('');
            }
          });
        }
      }
    }, 100);
  }

  // Créer un FormGroup pour un support
  createSupportFormGroup(support: any = {}): FormGroup {
    const prixUnitaire = support.prix_unitaire !== undefined ? support.prix_unitaire : true;
    const prixSupport = support.prix_support || 0;
    const nombreUnites = support.nombre_unites || 1;
    const prixSupportUnitaire = support.prix_support_unitaire || (prixUnitaire ? prixSupport : (nombreUnites > 0 ? prixSupport / nombreUnites : 0));
    
    const group = new FormGroup({
      nom_support: new FormControl({ value: support.nom_support || '', disabled: false }),
      prix_support: new FormControl({ value: prixSupport, disabled: false }),
      url_support: new FormControl({ value: support.url_support || '', disabled: false }),
      prix_unitaire: new FormControl({ value: prixUnitaire, disabled: false }),
      nombre_unites: new FormControl({ value: nombreUnites, disabled: prixUnitaire }),
      prix_support_unitaire: new FormControl({ value: prixSupportUnitaire, disabled: true })
    });

    // Écouter les changements pour recalculer
    group.get('prix_support')?.valueChanges.subscribe(() => this.recalculateSupportUnitaire(group));
    group.get('nombre_unites')?.valueChanges.subscribe(() => this.recalculateSupportUnitaire(group));
    group.get('prix_unitaire')?.valueChanges.subscribe(() => {
      const prixUnitaireValue = group.get('prix_unitaire')?.value;
      if (prixUnitaireValue) {
        group.get('nombre_unites')?.disable({ emitEvent: false });
      } else {
        group.get('nombre_unites')?.enable({ emitEvent: false });
      }
      this.recalculateSupportUnitaire(group);
    });

    return group;
  }

  // Recalculer le prix support unitaire pour un support
  recalculateSupportUnitaire(supportGroup: FormGroup): void {
    const prixUnitaire = supportGroup.get('prix_unitaire')?.value;
    const prixSupport = parseFloat(supportGroup.get('prix_support')?.value) || 0;
    const nombreUnites = parseFloat(supportGroup.get('nombre_unites')?.value) || 1;
    
    let prixSupportUnitaire = 0;
    if (prixUnitaire) {
      prixSupportUnitaire = prixSupport;
    } else {
      prixSupportUnitaire = nombreUnites > 0 ? prixSupport / nombreUnites : 0;
    }
    
    supportGroup.get('prix_support_unitaire')?.setValue(prixSupportUnitaire, { emitEvent: false });
    this.recalculateSupportsAndBenefice();
  }

  // Recalculer prix final des supports et prix bénéfice
  recalculateSupportsAndBenefice(): void {
    if (!this.formGroup) return;
    
    const prixFinalValue = this.formGroup.get('prix_final')?.value;
    const quantiteValue = this.formGroup.get('quantité')?.value;
    const prixFinal = parseFloat(String(prixFinalValue || 0)) || 0;
    const quantite = parseFloat(String(quantiteValue || 1)) || 1;
    
    const supportsArray = this.formGroup.get('supports') as FormArray;
    let prixFinalSupportsUnitaires = 0;
    let prixFinalSupports = 0;
    
    supportsArray.controls.forEach((supportControl: any) => {
      const supportGroup = supportControl as FormGroup;
      const prixSupportUnitaire = parseFloat(String(supportGroup.get('prix_support_unitaire')?.value || 0)) || 0;
      prixFinalSupportsUnitaires += prixSupportUnitaire;
      prixFinalSupports += prixSupportUnitaire * quantite;
    });
    
    (this.formGroup.get('prix_final_supports_unitaires') as any)?.setValue(prixFinalSupportsUnitaires.toFixed(2), { emitEvent: false });
    (this.formGroup.get('prix_final_supports') as any)?.setValue(prixFinalSupports.toFixed(2), { emitEvent: false });
    
    const prixBenefice = prixFinal - prixFinalSupports;
    (this.formGroup.get('prix_benefice') as any)?.setValue(prixBenefice.toFixed(2), { emitEvent: false });
  }

  // Recalculer le prix unitaire final à partir du prix final
  recalculatePrixUnitaireFromFinal(): void {
    if (!this.formGroup) return;
    
    const prixFinalValue = this.formGroup.get('prix_final')?.value;
    const quantiteValue = this.formGroup.get('quantité')?.value;
    const prixFinal = parseFloat(String(prixFinalValue || 0)) || 0;
    const quantite = parseFloat(String(quantiteValue || 1)) || 1;
    
    if (quantite > 0) {
      const prixUnitaire = prixFinal / quantite;
      (this.formGroup.get('prix_unitaire_final') as any)?.setValue(prixUnitaire.toFixed(2), { emitEvent: false });
    }
  }

  // Recalculer le prix final à partir du prix unitaire final
  recalculatePrixFinalFromUnitaire(): void {
    if (!this.formGroup) return;
    
    const prixUnitaireValue = this.formGroup.get('prix_unitaire_final')?.value;
    const quantiteValue = this.formGroup.get('quantité')?.value;
    const prixUnitaire = parseFloat(String(prixUnitaireValue || 0)) || 0;
    const quantite = parseFloat(String(quantiteValue || 1)) || 1;
    
    const prixFinal = prixUnitaire * quantite;
    (this.formGroup.get('prix_final') as any)?.setValue(prixFinal.toFixed(2), { emitEvent: false });
  }

  // Ajouter un nouveau support
  addSupport(): void {
    const supportsArray = this.formGroup.get('supports') as FormArray;
    supportsArray.push(this.createSupportFormGroup({}));
    this.recalculateSupportsAndBenefice();
  }

  // Supprimer un support
  removeSupport(index: number): void {
    const supportsArray = this.formGroup.get('supports') as FormArray;
    supportsArray.removeAt(index);
    this.recalculateSupportsAndBenefice();
  }

  // Getter pour accéder au FormArray des supports
  get supportsFormArray(): FormArray {
    return this.formGroup.get('supports') as FormArray;
  }

  // Helper pour vérifier si le prix est unitaire pour un support
  isPrixUnitaire(supportGroup: FormGroup): boolean {
    return supportGroup.get('prix_unitaire')?.value === true;
  }

  togglePrixFields(): void {
    this.showPrixFields.set(!this.showPrixFields());
  }

  onPayeChange(): void {
    // Pour nouvelle commande, pas besoin de sauvegarder immédiatement
  }

  getAttenteReponseControl(): FormControl<boolean> {
    return this.formGroup.get('attente_reponse') as FormControl<boolean>;
  }

  // Méthodes pour les statuts
  isStatutSelected(statut: StatutCommande): boolean {
    return this.statutInitial === statut;
  }

  onStatutChange(statut: StatutCommande): void {
    this.formGroup.get('statut_initial')?.setValue(statut);
  }

  buildAdresseComplete(rue?: string, codePostal?: string, ville?: string, pays?: string): string | null {
    const parts: string[] = [];
    if (rue?.trim()) parts.push(rue.trim());
    if (codePostal?.trim()) parts.push(codePostal.trim());
    if (ville?.trim()) parts.push(ville.trim());
    if (pays?.trim()) parts.push(pays.trim());
    return parts.length > 0 ? parts.join(', ') : null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.uploadedFiles = [...this.uploadedFiles, ...files];
      this.formGroup.get('fichiers_joints')?.setValue(this.uploadedFiles);
    }
  }

  /** URLs créées pour l’aperçu des images (à révoquer au démontage ou à la suppression). */
  private filePreviewUrls = new Map<File, string>();

  getFilePreviewUrl(file: File): string {
    if (!file.type.startsWith('image/')) return '';
    let url = this.filePreviewUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      this.filePreviewUrls.set(file, url);
    }
    return url;
  }

  removeFile(index: number): void {
    const file = this.uploadedFiles[index];
    const url = file && this.filePreviewUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      this.filePreviewUrls.delete(file);
    }
    this.uploadedFiles.splice(index, 1);
    this.formGroup.get('fichiers_joints')?.setValue(this.uploadedFiles);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      // Filtrer les fichiers selon les types acceptés
      const acceptedFiles = fileArray.filter(file => {
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        return fileType.startsWith('image/') ||
               fileName.endsWith('.pdf') ||
               fileName.endsWith('.doc') ||
               fileName.endsWith('.docx');
      });
      
      if (acceptedFiles.length > 0) {
        this.uploadedFiles = [...this.uploadedFiles, ...acceptedFiles];
        this.formGroup.get('fichiers_joints')?.setValue(this.uploadedFiles);
      }
    }
  }

  toggleCouleur(couleur: Couleur): void {
    const couleurControl = this.formGroup.get('couleur');
    const currentValue: string[] = couleurControl?.value || [];
    const index = currentValue.indexOf(couleur);
    
    if (index > -1) {
      currentValue.splice(index, 1);
    } else {
      currentValue.push(couleur);
    }
    
    couleurControl?.setValue([...currentValue]);
  }

  isCouleurSelected(couleur: Couleur): boolean {
    const currentValue: string[] = this.formGroup.get('couleur')?.value || [];
    return currentValue.includes(couleur);
  }


  isFormValid(): boolean {
    const nomCommande = this.formGroup.get('nom_commande')?.value?.trim();
    // Seul le nom de la commande est obligatoire pour activer le bouton.
    // L'email et les autres champs optionnels sont validés à l'envoi / côté backend.
    if (!nomCommande) return false;
    if (this.isVente()) {
      if (!nomCommande.startsWith(this.ventePrefix)) return false;
      return nomCommande.slice(this.ventePrefix.length).trim().length > 0;
    }
    return true;
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      const mailControl = this.formGroup.get('mail');
      const mailValue = (mailControl?.value as string)?.trim();
      if (mailValue && mailControl && !mailControl.valid) {
        this.formGroup.markAllAsTouched();
        this.errors.set(getFormValidationErrors(this.formGroup));
        return;
      }

      const formValue: any = this.formGroup.value;
      const isVente = this.isVente();
      const nomCommandeValue = isVente
        ? this.ensureVentePrefix(formValue.nom_commande || '')
        : (formValue.nom_commande || '');

      // Préparer le payload coordonnees_contact
      const coordonneesContact: any = {};
      if (formValue.nom?.trim()) coordonneesContact.nom = formValue.nom.trim();
      if (formValue.prenom?.trim()) coordonneesContact.prenom = formValue.prenom.trim();
      if (formValue.telephone?.trim()) coordonneesContact.telephone = formValue.telephone.trim();
      if (formValue.mail?.trim()) coordonneesContact.mail = formValue.mail.trim();
      if (formValue.tva?.trim()) coordonneesContact.tva = formValue.tva.trim();
      
      const adresse = this.buildAdresseComplete(formValue.rue, formValue.code_postal, formValue.ville, formValue.pays);
      if (adresse) coordonneesContact.adresse = adresse;

      // S'assurer que les types correspondent à ce que le backend attend
      const quantiteNum = formValue.quantité != null
        ? (typeof formValue.quantité === 'number' ? formValue.quantité : parseInt(String(formValue.quantité), 10))
        : 1;
      const quantiteFinale = Number.isNaN(quantiteNum) || quantiteNum < 1 ? 1 : quantiteNum;

      // Récupérer le statut initial depuis le formulaire
      const statutInitial = isVente
        ? StatutCommande.TERMINE
        : (formValue.statut_initial || StatutCommande.EN_ATTENTE_INFORMATION);

      // Récupérer les couleurs sélectionnées
      const couleursSelectionnees = isVente
        ? []
        : (formValue.couleur && Array.isArray(formValue.couleur) ? formValue.couleur : []);

      const payload: any = {
        nom_commande: nomCommandeValue,
        deadline: isVente ? null : (formValue.deadline || null),
        description_projet: formValue.description_projet || null,
        dimensions_souhaitees: isVente ? null : (formValue.dimensions_souhaitees || null),
        couleur: couleursSelectionnees,
        support: isVente
          ? null
          : ((formValue.support && formValue.support.trim()) ? formValue.support.trim() : this.supportParDefaut),
        police_ecriture: isVente ? null : (formValue.police_ecriture || null),
        texte_personnalisation: isVente ? null : (formValue.texte_personnalisation || null),
        fichiers_joints: [],
        quantité: quantiteFinale,
        payé: Boolean(formValue.payé),
        commentaire_paye: formValue.commentaire_paye || null,
        statut_initial: statutInitial,
        attente_reponse: isVente ? false : Boolean(formValue.attente_reponse ?? false),
        mode_contact: formValue.mode_contact || null,
        prix_final: formValue.prix_final !== null && formValue.prix_final !== undefined && formValue.prix_final !== '' ? parseFloat(String(formValue.prix_final)) : null,
        prix_unitaire_final: formValue.prix_unitaire_final !== null && formValue.prix_unitaire_final !== undefined && formValue.prix_unitaire_final !== '' ? parseFloat(String(formValue.prix_unitaire_final)) : null,
        ...(Object.keys(coordonneesContact).length > 0 && { coordonnees_contact: coordonneesContact }),
        supports: formValue.supports && Array.isArray(formValue.supports) 
          ? formValue.supports
              .filter((s: any) => s && (s.nom_support || s.prix_support || s.url_support))
              .map((s: any) => ({
                nom_support: s.nom_support || null,
                prix_support: s.prix_support !== null && s.prix_support !== undefined && s.prix_support !== '' ? parseFloat(String(s.prix_support)) : null,
                url_support: s.url_support || null,
                prix_unitaire: s.prix_unitaire !== undefined ? Boolean(s.prix_unitaire) : true,
                nombre_unites: s.nombre_unites !== null && s.nombre_unites !== undefined && s.nombre_unites !== '' ? parseInt(String(s.nombre_unites), 10) : null,
                prix_support_unitaire: s.prix_support_unitaire !== null && s.prix_support_unitaire !== undefined && s.prix_support_unitaire !== '' ? parseFloat(String(s.prix_support_unitaire)) : null,
              }))
          : [],
      };

      console.log('Payload envoyé:', JSON.stringify(payload, null, 2));

      // 1. Créer la commande
      this.apiService.post(ApiURI.AJOUTER_COMMANDE, payload).subscribe({
        next: (response) => {
          if (!response.result) {
            this.errors.set([{
              control: 'commande',
              value: '',
              error: 'Erreur lors de la création de la commande. Veuillez réessayer.'
            }]);
            return;
          }
          const idCommande = response.data?.id_commande as string | undefined;
          const filesToUpload = [...this.uploadedFiles];

          if (!idCommande || filesToUpload.length === 0) {
            try {
              sessionStorage.removeItem(this.scrollKey);
            } catch {}
            this.showSuccessPopup.set(true);
            return;
          }

          // 2. Envoyer chaque fichier vers R2 (POST commande/:id/fichiers)
          const uploads = filesToUpload.map((file) => {
            const formData = new FormData();
            formData.append('file', file);
            return this.apiService.postFormData(COMMANDE_FICHIERS_UPLOAD(idCommande), formData);
          });

          forkJoin(uploads).subscribe({
            next: (responses) => {
              const allOk = Array.isArray(responses) && responses.every((r: any) => r?.result === true);
              try {
                sessionStorage.removeItem(this.scrollKey);
              } catch {}
              this.showSuccessPopup.set(true);
              if (!allOk) {
                this.errors.set([{
                  control: 'commande',
                  value: '',
                  error: 'Commande créée mais certains fichiers n\'ont pas pu être envoyés.'
                }]);
              }
            },
            error: (err) => {
              console.error('Erreur lors de l\'envoi des fichiers:', err);
              try {
                sessionStorage.removeItem(this.scrollKey);
              } catch {}
              this.showSuccessPopup.set(true);
              this.errors.set([{
                control: 'commande',
                value: '',
                error: 'Commande créée mais certains fichiers n\'ont pas pu être envoyés.'
              }]);
            }
          });
        },
        error: (error) => {
          console.error('Erreur lors de la création de la commande:', error);
          this.errors.set([{
            control: 'commande',
            value: '',
            error: 'Erreur lors de la création de la commande. Veuillez vérifier vos informations.'
          }]);
        }
      });
    } else {
      this.submitted = true;
      this.formGroup.markAllAsTouched();
      this.errors.set(this.getAllFormErrors());
    }
  }

  onCancel(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED]);
  }

  onCreateNewCommande(): void {
    this.showSuccessPopup.set(false);
    this.formGroup.reset();
    
    // Réinitialiser les valeurs par défaut
    (this.formGroup.get('pays') as any)?.setValue('Belgique');
    this.formGroup.get('statut_initial')?.setValue(StatutCommande.EN_ATTENTE_INFORMATION);
    if (this.isVente()) {
      this.formGroup.get('nom_commande')?.setValue(this.ventePrefix);
      this.formGroup.get('attente_reponse')?.setValue(false);
      this.formGroup.get('statut_initial')?.setValue(StatutCommande.TERMINE);
    }
    
    this.filePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    this.filePreviewUrls.clear();
    this.uploadedFiles = [];
    this.errors.set([]);
    // Scroll vers le haut de la page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private readonly entryFromKey = 'commandes-en-cours-entry-from';

  onViewCommandes(): void {
    this.showSuccessPopup.set(false);
    if (!this.isVente()) {
      try {
        sessionStorage.setItem(this.entryFromKey, 'nouvelle');
      } catch {}
      this.router.navigate([AppRoutes.COMMANDES_EN_COURS]);
      return;
    }
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'terminees']);
  }

  onTypeToggle(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.setVenteMode(target.checked);
  }

  setVenteMode(isVente: boolean): void {
    this.isVente.set(isVente);
    const nomControl = this.formGroup.get('nom_commande');
    if (isVente) {
      const currentStatut = this.formGroup.get('statut_initial')?.value;
      if (currentStatut && currentStatut !== StatutCommande.TERMINE) {
        this.lastNonVenteStatut = currentStatut;
      }
      this.formGroup.get('statut_initial')?.setValue(StatutCommande.TERMINE);
      this.formGroup.get('attente_reponse')?.setValue(false);
      if (nomControl) {
        nomControl.setValue(this.ensureVentePrefix(nomControl.value || ''), { emitEvent: false });
      }
      return;
    }
    this.formGroup.get('statut_initial')?.setValue(this.lastNonVenteStatut || StatutCommande.EN_ATTENTE_INFORMATION);
    if (nomControl) {
      nomControl.setValue(this.removeVentePrefix(nomControl.value || ''), { emitEvent: false });
    }
  }

  private ensureVentePrefix(value: string): string {
    const raw = value || '';
    const trimmed = raw.trimStart();
    if (trimmed.startsWith(this.ventePrefix)) return trimmed;
    const withoutPrefix = trimmed.replace(/^Vente\s*\|\s*/i, '');
    return `${this.ventePrefix}${withoutPrefix.trimStart()}`;
  }

  private removeVentePrefix(value: string): string {
    const raw = value || '';
    if (raw.trimStart().startsWith(this.ventePrefix)) {
      return raw.trimStart().slice(this.ventePrefix.length).trimStart();
    }
    return raw;
  }

  onSupportFocus(event: Event): void {
    this.supportInputFocus = true;
    // Trouver l'input dans l'événement
    const target = event.target as HTMLElement;
    const input = target.querySelector('input') || target.closest('.input-wrapper')?.querySelector('input') as HTMLInputElement;
    
    if (input) {
      // Si le champ contient la valeur par défaut, vider le champ
      if (input.value === this.supportParDefaut) {
        setTimeout(() => {
          this.formGroup.get('support')?.setValue('');
          input.focus();
        }, 0);
      }
    }
  }

  onSupportBlur(): void {
    this.supportInputFocus = false;
  }

  getSupportPlaceholder(): string {
    const supportValue = this.formGroup.get('support')?.value?.trim();
    // Afficher le placeholder uniquement si le champ est vide et en focus
    if (!supportValue && this.supportInputFocus) {
      return this.supportParDefaut;
    }
    return '';
  }
}
