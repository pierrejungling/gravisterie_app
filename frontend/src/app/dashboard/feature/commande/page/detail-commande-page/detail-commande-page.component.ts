import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { HeaderComponent, FloatingLabelInputComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande, ModeContact, Couleur } from '../../model/commande.interface';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-detail-commande-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent],
  templateUrl: './detail-commande-page.component.html',
  styleUrl: './detail-commande-page.component.scss'
})
export class DetailCommandePageComponent implements OnInit, OnDestroy, AfterViewChecked {
  commande: WritableSignal<Commande | null> = signal(null);
  isLoading: WritableSignal<boolean> = signal(false);
  isEditMode: WritableSignal<boolean> = signal(false);
  showPrixFields: WritableSignal<boolean> = signal(false);
  showDeleteConfirm: WritableSignal<boolean> = signal(false);
  returnPage: string = 'en-cours'; // Page par défaut pour le retour
  private scrollRestored: boolean = false;
  private isInitialLoad: boolean = true; // Flag pour distinguer le chargement initial
  
  // Exposer StatutCommande et ModeContact pour l'utiliser dans le template
  readonly StatutCommande = StatutCommande;
  readonly ModeContact = ModeContact;
  
  // Modes de contact disponibles
  readonly modesContact = [
    { value: ModeContact.MAIL, label: 'Mail', emoji: '📧' },
    { value: ModeContact.TEL, label: 'Téléphone', emoji: '📞' },
    { value: ModeContact.META, label: 'Meta', emoji: '💬' }
  ];

  // Options de couleurs disponibles
  couleursDisponibles: Couleur[] = [
    Couleur.NOIR,
    Couleur.NATUREL,
    Couleur.LASURE,
    Couleur.OR,
    Couleur.ARGENT,
    Couleur.BLANC,
    Couleur.GRAVURE_PEINTE
  ];
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private scrollKey: string = '';

  formGroup!: FormGroup;

  get(controlName: string): FormControl {
    if (!this.formGroup) {
      // Retourner un FormControl vide si le formulaire n'est pas encore initialisé
      return new FormControl('');
    }
    return this.formGroup.get(controlName) as FormControl;
  }
  
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

  // Calculer le statut de la deadline pour la coloration
  getDeadlineStatus(): 'warning' | 'danger' | null {
    const cmd = this.commande();
    if (!cmd || !cmd.deadline) {
      return null;
    }

    const deadlineDate = new Date(cmd.deadline);
    const today = new Date();
    // Réinitialiser les heures pour comparer uniquement les dates
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Rouge si deadline aujourd'hui ou dépassée
    if (diffDays <= 0) {
      return 'danger';
    }
    // Orange si J-7 (7 jours ou moins avant la deadline)
    if (diffDays <= 7) {
      return 'warning';
    }

    return null;
  }

  private readonly detailReturnPageKey = 'detail-return-page';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    try {
      const stored = sessionStorage.getItem(this.detailReturnPageKey);
      this.returnPage = stored === 'terminees' ? 'terminees' : 'en-cours';
    } catch {
      this.returnPage = 'en-cours';
    }
    
    // Créer une clé unique pour cette commande
    this.scrollKey = `detail-commande-${id}-scroll`;
    
    // Sauvegarder la position de scroll avant le rechargement
    window.addEventListener('beforeunload', this.saveScrollPosition);
    
    if (id) {
      this.loadCommande(id);
    }
  }

  ngAfterViewChecked(): void {
    // Restaurer la position de scroll uniquement lors du chargement initial
    if (this.isInitialLoad && !this.isLoading() && this.commande() && !this.scrollRestored) {
      const savedScroll = sessionStorage.getItem(this.scrollKey);
      if (savedScroll) {
        this.restoreScrollPosition(parseInt(savedScroll, 10));
      } else {
        // Si pas de scroll sauvegardé, marquer quand même que le chargement initial est terminé
        this.isInitialLoad = false;
      }
    }
  }

  private restoreScrollPosition(scrollPosition: number): void {
    // Méthode robuste compatible Safari avec plusieurs tentatives
    const attemptScroll = (attempts: number = 0) => {
      if (attempts > 10) {
        // Arrêter après 10 tentatives
        this.scrollRestored = true;
        this.isInitialLoad = false;
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
            this.isInitialLoad = false;
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
  }

  private saveScrollPosition = (): void => {
    if (this.scrollKey) {
      sessionStorage.setItem(this.scrollKey, window.scrollY.toString());
    }
  }

  loadCommande(id: string): void {
    this.isLoading.set(true);
    this.apiService.get(`${ApiURI.GET_COMMANDE_BY_ID}/${id}`).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.commande.set(response.data);
          this.initForm();
        }
        this.isLoading.set(false);
        // Ne pas réinitialiser scrollRestored ici pour éviter la restauration lors des rechargements après actions utilisateur
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la commande:', error);
        this.isLoading.set(false);
      }
    });
  }

  initForm(): void {
    const cmd = this.commande();
    if (!cmd) return;

    const isEdit = this.isEditMode();
    
    this.formGroup = new FormGroup({
      nom_commande: new FormControl({ value: cmd.produit || '', disabled: !isEdit }, [Validators.required]),
      deadline: new FormControl({ value: cmd.deadline ? cmd.deadline.split('T')[0] : '', disabled: !isEdit }),
      description: new FormControl({ value: cmd.description || '', disabled: !isEdit }),
      dimensions: new FormControl({ value: cmd.gravure?.dimensions || '', disabled: !isEdit }),
      couleur: new FormControl({ value: Array.isArray(cmd.personnalisation?.couleur) ? cmd.personnalisation.couleur : [], disabled: !isEdit }),
      support: new FormControl({ value: cmd.support?.nom_support || '', disabled: !isEdit }),
      police_ecriture: new FormControl({ value: cmd.personnalisation?.police || '', disabled: !isEdit }),
      texte_personnalisation: new FormControl({ value: cmd.personnalisation?.texte || '', disabled: !isEdit }),
      quantité: new FormControl({ value: cmd.quantité || 1, disabled: !isEdit }),
      prix_final: new FormControl({ value: cmd.prix_final || '', disabled: !isEdit }),
      prix_unitaire_final: new FormControl({ value: cmd.prix_unitaire_final || (cmd.prix_final && cmd.quantité ? cmd.prix_final / cmd.quantité : ''), disabled: !isEdit }),
      payé: new FormControl(cmd.payé || false), // Toujours modifiable
      commentaire_paye: new FormControl({ value: cmd.commentaire_paye || '', disabled: !isEdit }),
      attente_reponse: new FormControl(cmd.attente_reponse ?? false), // Toujours modifiable
      prix_support: new FormControl({ value: cmd.support?.prix_support || '', disabled: !isEdit }),
      url_support: new FormControl({ value: cmd.support?.url_support || '', disabled: !isEdit }),
      supports: this.createSupportsFormArray(cmd, isEdit),
      prix_final_supports_unitaires: new FormControl({ value: 0, disabled: true }), // Read-only, calculé
      prix_final_supports: new FormControl({ value: 0, disabled: true }), // Read-only, calculé
      prix_benefice: new FormControl({ value: 0, disabled: true }), // Read-only, calculé
      // Coordonnées contact
      nom: new FormControl({ value: cmd.client.nom || '', disabled: !isEdit }),
      prenom: new FormControl({ value: cmd.client.prénom || '', disabled: !isEdit }),
      telephone: new FormControl({ value: cmd.client.téléphone || '', disabled: !isEdit }),
      mail: new FormControl({ value: cmd.client.mail || '', disabled: !isEdit }, [Validators.email]),
      // Adresse décomposée
      rue: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 0) || '', disabled: !isEdit }),
      code_postal: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 1) || '', disabled: !isEdit }),
      ville: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 2) || '', disabled: !isEdit }),
      pays: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 3) || 'Belgique', disabled: !isEdit }),
      tva: new FormControl({ value: cmd.client.tva || '', disabled: !isEdit }),
      mode_contact: new FormControl({ value: cmd.mode_contact || '', disabled: !isEdit }),
    });

    // Écouter les changements pour recalculer automatiquement
    // Utiliser un flag pour éviter les boucles infinies
    let isCalculatingPF = false;
    let isCalculatingPU = false;
    
    this.formGroup.get('quantité')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      // Si prix final existe, recalculer PU. Sinon, si PU existe, recalculer PF
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
    });
    
    this.formGroup.get('prix_final')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      isCalculatingPU = true;
      this.recalculatePrixUnitaireFromFinal();
      isCalculatingPU = false;
    });
    
    this.formGroup.get('prix_unitaire_final')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      isCalculatingPF = true;
      this.recalculatePrixFinalFromUnitaire();
      isCalculatingPF = false;
    });
    
    // Calcul initial : si prix_final existe, calculer PU, sinon si PU existe, calculer PF
    const prixFinal = this.formGroup.get('prix_final')?.value;
    const prixUnitaire = this.formGroup.get('prix_unitaire_final')?.value;
    if (prixFinal) {
      this.recalculatePrixUnitaireFromFinal();
    } else if (prixUnitaire) {
      this.recalculatePrixFinalFromUnitaire();
    }
  }

  extractAdressePart(adresse: string | null | undefined, index: number): string {
    if (!adresse) return '';
    const parts = adresse.split(',').map(p => p.trim());
    return parts[index] || '';
  }

  buildAdresseComplete(rue?: string, codePostal?: string, ville?: string, pays?: string): string | null {
    const parts: string[] = [];
    if (rue?.trim()) parts.push(rue.trim());
    if (codePostal?.trim()) parts.push(codePostal.trim());
    if (ville?.trim()) parts.push(ville.trim());
    if (pays?.trim()) parts.push(pays.trim());
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Créer le FormArray pour les supports
  createSupportsFormArray(cmd: Commande, isEdit: boolean): FormArray {
    const supportsArray = new FormArray<FormGroup>([]);
    
    // Si des supports existent déjà, les charger
    if (cmd.supports && cmd.supports.length > 0) {
      cmd.supports.forEach(support => {
        supportsArray.push(this.createSupportFormGroup(support, isEdit));
      });
    } else if (cmd.support) {
      // Migration depuis l'ancien format (support unique)
      const supportGroup = this.createSupportFormGroup({
        nom_support: cmd.support.nom_support,
        prix_support: cmd.support.prix_support,
        url_support: cmd.support.url_support,
        prix_unitaire: true,
        nombre_unites: 1,
        prix_support_unitaire: cmd.support.prix_support || 0
      }, isEdit);
      supportsArray.push(supportGroup);
    } else {
      // Si aucun support, créer un support vide par défaut
      supportsArray.push(this.createSupportFormGroup({}, isEdit));
    }
    
    return supportsArray;
  }

  // Créer un FormGroup pour un support
  createSupportFormGroup(support: any = {}, isEdit: boolean): FormGroup {
    const prixUnitaire = support.prix_unitaire !== undefined ? support.prix_unitaire : true;
    const prixSupport = support.prix_support || 0;
    const nombreUnites = support.nombre_unites || 1;
    const prixSupportUnitaire = support.prix_support_unitaire || (prixUnitaire ? prixSupport : (nombreUnites > 0 ? prixSupport / nombreUnites : 0));
    
    const group = new FormGroup({
      nom_support: new FormControl({ value: support.nom_support || '', disabled: !isEdit }),
      prix_support: new FormControl({ value: prixSupport, disabled: !isEdit }),
      url_support: new FormControl({ value: support.url_support || '', disabled: !isEdit }),
      prix_unitaire: new FormControl({ value: prixUnitaire, disabled: !isEdit }),
      nombre_unites: new FormControl({ value: nombreUnites, disabled: !isEdit || prixUnitaire }),
      prix_support_unitaire: new FormControl({ value: prixSupportUnitaire, disabled: true }) // Read-only, calculé
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

  // Recalculer le prix unitaire final à partir du prix final (formule inverse)
  recalculatePrixUnitaireFromFinal(): void {
    if (!this.formGroup) return;
    
    const prixFinal = parseFloat(this.formGroup.get('prix_final')?.value) || 0;
    const quantite = parseFloat(this.formGroup.get('quantité')?.value) || 1;
    const prixUnitaireFinal = quantite > 0 ? prixFinal / quantite : 0;
    this.formGroup.get('prix_unitaire_final')?.setValue(prixUnitaireFinal.toFixed(2), { emitEvent: false });
    
    // Recalculer aussi les prix des supports et bénéfice
    this.recalculateSupportsAndBenefice();
  }

  // Recalculer le prix final à partir du prix unitaire final
  recalculatePrixFinalFromUnitaire(): void {
    if (!this.formGroup) return;
    
    const prixUnitaireFinal = parseFloat(this.formGroup.get('prix_unitaire_final')?.value) || 0;
    const quantite = parseFloat(this.formGroup.get('quantité')?.value) || 1;
    const prixFinal = prixUnitaireFinal * quantite;
    this.formGroup.get('prix_final')?.setValue(prixFinal.toFixed(2), { emitEvent: false });
    
    // Recalculer aussi les prix des supports et bénéfice
    this.recalculateSupportsAndBenefice();
  }

  // Recalculer tous les prix (prix unitaire final, prix final supports, prix bénéfice)
  recalculateAllPrices(): void {
    if (!this.formGroup) return;
    
    // Calculer prix unitaire final = prix final / quantité
    const prixFinal = parseFloat(this.formGroup.get('prix_final')?.value) || 0;
    const quantite = parseFloat(this.formGroup.get('quantité')?.value) || 1;
    const prixUnitaireFinal = quantite > 0 ? prixFinal / quantite : 0;
    this.formGroup.get('prix_unitaire_final')?.setValue(prixUnitaireFinal.toFixed(2), { emitEvent: false });
    
    // Recalculer aussi les prix des supports et bénéfice
    this.recalculateSupportsAndBenefice();
  }

  // Recalculer prix final des supports et prix bénéfice
  recalculateSupportsAndBenefice(): void {
    if (!this.formGroup) return;
    
    const prixFinal = parseFloat(this.formGroup.get('prix_final')?.value) || 0;
    const quantite = parseFloat(this.formGroup.get('quantité')?.value) || 1;
    
    // Calculer prix final des supports
    const supportsArray = this.formGroup.get('supports') as FormArray;
    let prixFinalSupportsUnitaires = 0; // Somme des prix unitaires (sans multiplier par quantité)
    let prixFinalSupports = 0; // Somme des prix unitaires * quantité
    
    supportsArray.controls.forEach((supportControl) => {
      const supportGroup = supportControl as FormGroup;
      const prixSupportUnitaire = parseFloat(supportGroup.get('prix_support_unitaire')?.value) || 0;
      prixFinalSupportsUnitaires += prixSupportUnitaire;
      prixFinalSupports += prixSupportUnitaire * quantite;
    });
    
    // Stocker le prix final des supports unitaires dans le formulaire
    this.formGroup.get('prix_final_supports_unitaires')?.setValue(prixFinalSupportsUnitaires.toFixed(2), { emitEvent: false });
    
    // Stocker le prix final des supports dans le formulaire
    this.formGroup.get('prix_final_supports')?.setValue(prixFinalSupports.toFixed(2), { emitEvent: false });
    
    // Calculer prix bénéfice = prix final - prix final supports
    const prixBenefice = prixFinal - prixFinalSupports;
    this.formGroup.get('prix_benefice')?.setValue(prixBenefice.toFixed(2), { emitEvent: false });
  }

  // Ajouter un nouveau support
  addSupport(): void {
    const supportsArray = this.formGroup.get('supports') as FormArray;
    const isEdit = this.isEditMode();
    supportsArray.push(this.createSupportFormGroup({}, isEdit));
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

  toggleEditMode(): void {
    const newEditMode = !this.isEditMode();
    this.isEditMode.set(newEditMode);
    
    // Désactiver/activer tous les FormControls selon le mode édition
    if (this.formGroup) {
      const controlsToDisable = [
        'nom_commande', 'deadline', 'description', 'dimensions', 'quantité', 'commentaire_paye',
        'support', 'police_ecriture', 'texte_personnalisation', 'prix_unitaire_final', 'prix_final',
        'prix_support', 'url_support', 'nom', 'prenom', 'telephone', 'mail',
        'rue', 'code_postal', 'ville', 'pays', 'tva', 'mode_contact'
      ];
      
      // Gérer les supports dans le FormArray
      const supportsArray = this.formGroup.get('supports') as FormArray;
      supportsArray.controls.forEach((supportControl) => {
        const supportGroup = supportControl as FormGroup;
        ['nom_support', 'prix_support', 'url_support', 'prix_unitaire', 'nombre_unites'].forEach(controlName => {
          const control = supportGroup.get(controlName);
          if (control) {
            if (newEditMode) {
              control.enable();
            } else {
              control.disable();
            }
          }
        });
      });
      
      controlsToDisable.forEach(controlName => {
        const control = this.formGroup.get(controlName);
        if (control) {
          if (newEditMode) {
            control.enable();
          } else {
            control.disable();
          }
        }
      });
      
      // S'assurer que prix_final et prix_unitaire_final sont bien activés en mode édition
      if (newEditMode) {
        this.formGroup.get('prix_final')?.enable();
        this.formGroup.get('prix_unitaire_final')?.enable();
      }
    }
  }

  togglePrixFields(): void {
    this.showPrixFields.set(!this.showPrixFields());
  }

  onSave(): void {
    if (!this.formGroup.valid || !this.commande()) return;

    const formValue = this.formGroup.value;
    const payload: any = {
      produit: formValue.nom_commande,
      deadline: formValue.deadline || null,
      description: formValue.description,
      quantité: formValue.quantité ? parseInt(formValue.quantité, 10) : null,
      payé: formValue.payé || false,
      commentaire_paye: formValue.commentaire_paye || null,
      attente_reponse: formValue.attente_reponse ?? false,
      mode_contact: formValue.mode_contact || null,
      prix_final: formValue.prix_final !== null && formValue.prix_final !== undefined && formValue.prix_final !== '' ? parseFloat(String(formValue.prix_final)) : null,
      prix_unitaire_final: formValue.prix_unitaire_final !== null && formValue.prix_unitaire_final !== undefined && formValue.prix_unitaire_final !== '' ? parseFloat(String(formValue.prix_unitaire_final)) : null,
      coordonnees_contact: {
        nom: formValue.nom,
        prenom: formValue.prenom,
        telephone: formValue.telephone,
        mail: formValue.mail,
        adresse: this.buildAdresseComplete(formValue.rue, formValue.code_postal, formValue.ville, formValue.pays),
        tva: formValue.tva,
      },
      support: {
        nom_support: formValue.support,
        prix_support: formValue.prix_support ? parseFloat(formValue.prix_support) : null,
        url_support: formValue.url_support,
      },
      supports: formValue.supports && Array.isArray(formValue.supports) 
        ? formValue.supports
            .filter((s: any) => s && (s.nom_support || s.prix_support || s.url_support)) // Filtrer les supports complètement vides
            .map((s: any) => ({
              nom_support: s.nom_support || null,
              prix_support: s.prix_support !== null && s.prix_support !== undefined && s.prix_support !== '' ? parseFloat(String(s.prix_support)) : null,
              url_support: s.url_support || null,
              prix_unitaire: s.prix_unitaire !== undefined ? Boolean(s.prix_unitaire) : true,
              nombre_unites: s.nombre_unites !== null && s.nombre_unites !== undefined && s.nombre_unites !== '' ? parseInt(String(s.nombre_unites), 10) : null,
              prix_support_unitaire: s.prix_support_unitaire !== null && s.prix_support_unitaire !== undefined && s.prix_support_unitaire !== '' ? parseFloat(String(s.prix_support_unitaire)) : null,
            }))
        : [],
      personnalisation: {
        texte: formValue.texte_personnalisation,
        police: formValue.police_ecriture,
        couleur: Array.isArray(formValue.couleur) ? formValue.couleur : [],
      },
      gravure: {
        dimensions: formValue.dimensions,
      },
    };

    const id = this.commande()!.id_commande;
    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: (response) => {
        this.loadCommande(id);
        this.isEditMode.set(false);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour:', error);
      }
    });
  }

  onCancel(): void {
    this.initForm();
    this.isEditMode.set(false);
  }

  onPayeChange(): void {
    if (!this.commande()) return;

    const id = this.commande()!.id_commande;
    const payeValue = this.formGroup.get('payé')?.value || false;
    const commentairePaye = this.formGroup.get('commentaire_paye')?.value || null;

    // Envoyer uniquement les champs payé et commentaire_paye
    const payload: any = {
      payé: payeValue,
      commentaire_paye: commentairePaye?.trim() || null,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
        // Recharger la commande pour avoir les données à jour
        this.loadCommande(id);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut payé:', error);
        // Revert la valeur en cas d'erreur
        this.formGroup.get('payé')?.setValue(!payeValue, { emitEvent: false });
      }
    });
  }

  onAttenteReponseChange(): void {
    if (!this.commande()) return;

    const id = this.commande()!.id_commande;
    const attenteReponseValue = this.formGroup.get('attente_reponse')?.value ?? false;

    // Envoyer uniquement le champ attente_reponse
    const payload: any = {
      attente_reponse: attenteReponseValue,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
        // Recharger la commande pour avoir les données à jour
        this.loadCommande(id);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour de l\'attente réponse:', error);
        // Revert la valeur en cas d'erreur
        this.formGroup.get('attente_reponse')?.setValue(!attenteReponseValue, { emitEvent: false });
      }
    });
  }

  isStatutChecked(statut: StatutCommande): boolean {
    const cmd = this.commande();
    if (!cmd) return false;
    
    // Si la commande est annulée, seul le statut ANNULEE est coché, tous les autres sont décochés
    if (cmd.statut_commande === StatutCommande.ANNULEE) {
      return statut === StatutCommande.ANNULEE;
    }
    
    // Si la commande est terminée, toutes les étapes sont cochées (sauf ANNULEE)
    if (cmd.statut_commande === StatutCommande.TERMINE) {
      return statut !== StatutCommande.ANNULEE;
    }
    
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Pour les 4 dernières colonnes : ils sont cochés seulement quand ils sont complétés
    // Si un statut final est dans statuts_actifs, c'est qu'il est actif mais pas encore complété (donc pas coché)
    if (statutsFinaux.includes(statut)) {
      // Un statut final est coché seulement s'il n'est PAS dans statuts_actifs (il a été complété)
      return cmd.statuts_actifs ? !cmd.statuts_actifs.includes(statut) : false;
    }
    
    // Pour les autres statuts, vérifier si c'est une étape précédente (complétée)
    const ordreEtapes: StatutCommande[] = [
      StatutCommande.EN_ATTENTE_INFORMATION,
      StatutCommande.A_MODELLISER_PREPARER,
      StatutCommande.A_GRAVER,
      StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
      StatutCommande.A_PRENDRE_EN_PHOTO,
    ];
    
    const indexStatut = ordreEtapes.indexOf(statut);
    const indexActuel = ordreEtapes.indexOf(cmd.statut_commande);
    
    // Si le statut demandé est une étape précédente, elle est complétée (cochée)
    // Mais aussi si on est dans les colonnes finales, toutes les étapes précédentes sont complétées
    if (indexStatut !== -1 && indexActuel !== -1 && indexStatut < indexActuel) {
      return true;
    }
    
    // Si on est dans les colonnes finales (statuts_actifs existe), toutes les étapes précédentes sont complétées
    if (statutsFinaux.some(s => cmd.statuts_actifs?.includes(s))) {
      const indexStatutInOrdre = ordreEtapes.indexOf(statut);
      if (indexStatutInOrdre !== -1 && indexStatutInOrdre < ordreEtapes.indexOf(StatutCommande.A_PRENDRE_EN_PHOTO)) {
        return true;
      }
    }
    
    // "À Prendre en photo" est complétée si les statuts finaux sont créés (statuts_actifs existe)
    // OU si au moins un des 3 statuts finaux est complété (pas dans statuts_actifs)
    if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
      // Si statuts_actifs existe, "À Prendre en photo" est complétée (même si les statuts finaux ne sont pas encore complétés)
      if (cmd.statuts_actifs && cmd.statuts_actifs.length > 0) {
        return true;
      }
      return false;
    }
    
    // Si on est dans les colonnes finales (statuts_actifs existe), les autres étapes précédentes sont complétées
    if (statutsFinaux.some(s => cmd.statuts_actifs?.includes(s))) {
      // Les autres étapes précédentes sont complétées
      const indexStatutInOrdre = ordreEtapes.indexOf(statut);
      if (indexStatutInOrdre !== -1 && indexStatutInOrdre < ordreEtapes.indexOf(StatutCommande.A_PRENDRE_EN_PHOTO)) {
        return true;
      }
    }
    
    // Le statut actuel n'est PAS coché (il est en cours, pas encore fait)
    return false;
  }

  isStatutActuel(statut: StatutCommande): boolean {
    const cmd = this.commande();
    if (!cmd) return false;
    
    // ANNULEE n'est jamais "actuel" au sens workflow (pas de bordure bleue)
    if (statut === StatutCommande.ANNULEE) {
      return false;
    }
    
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Si la commande est annulée, aucun autre statut n'est actuel
    if (cmd.statut_commande === StatutCommande.ANNULEE) {
      return false;
    }
    
    // Si on est dans les colonnes finales (statuts_actifs existe), "À Prendre en photo" n'est plus actuel
    if (statutsFinaux.some(s => cmd.statuts_actifs?.includes(s))) {
      // "À Prendre en photo" est complétée, donc plus actuelle
      return false;
    }
    
    // Sinon, seul le statut principal est actuel
    return cmd.statut_commande === statut;
  }

  isStatutActif(statut: StatutCommande): boolean {
    const cmd = this.commande();
    if (!cmd) return false;
    
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Pour les 4 statuts finaux, ils sont actifs (bordure bleue) seulement s'ils sont dans statuts_actifs ET pas encore cochés
    // Si un statut final est coché (pas dans statuts_actifs), il n'est plus actif, il est complété (vert)
    if (statutsFinaux.includes(statut)) {
      // Actif seulement s'il est dans statuts_actifs (pas encore complété)
      return cmd.statuts_actifs?.includes(statut) || false;
    }
    
    return false;
  }

  isStatutDisabled(statut: StatutCommande): boolean {
    const cmd = this.commande();
    if (!cmd) return true;
    
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];
    
    // Le statut ANNULEE est toujours modifiable, peu importe l'état de la commande
    if (statut === StatutCommande.ANNULEE) {
      return false; // Toujours activable
    }
    
    // Si la commande est annulée, tous les autres statuts sont grisés (sauf ANNULEE elle-même)
    if (cmd.statut_commande === StatutCommande.ANNULEE && statut as string !== 'annulee') {
      return true; // Tous les autres statuts sont désactivés
    }
    
    // Si la commande est terminée, toutes les étapes sont modifiables (pour permettre le retour en arrière)
    if (cmd.statut_commande === StatutCommande.TERMINE) {
      return false; // Toutes les étapes sont activables pour permettre le décochage
    }
    
    // Pour les statuts finaux, ils sont désactivés si "À Prendre en photo" n'est pas complété
    if (statutsFinaux.includes(statut)) {
      // Si statuts_actifs n'existe pas ou est vide, "À Prendre en photo" n'est pas complété
      // Donc les statuts finaux doivent être désactivés
      if (!cmd.statuts_actifs || cmd.statuts_actifs.length === 0) {
        return true; // Désactivés tant que "À Prendre en photo" n'est pas complété
      }
      // Si statuts_actifs existe, les statuts finaux sont activables
      return false;
    }
    
    // Pour les autres statuts, vérifier l'ordre
    const ordreEtapes: StatutCommande[] = [
      StatutCommande.EN_ATTENTE_INFORMATION,
      StatutCommande.A_MODELLISER_PREPARER,
      StatutCommande.A_GRAVER,
      StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
      StatutCommande.A_PRENDRE_EN_PHOTO,
    ];
    
    const indexStatut = ordreEtapes.indexOf(statut);
    const indexActuel = ordreEtapes.indexOf(cmd.statut_commande);
    
    // Si on est dans les colonnes finales (statuts_actifs existe), toutes les étapes sont activables
    if (statutsFinaux.some(s => cmd.statuts_actifs?.includes(s))) {
      return false; // Toutes les étapes sont activables
    }
    
    // Les étapes précédentes sont activables (pour décochage) - elles doivent être modifiables en vert
    if (indexStatut !== -1 && indexActuel !== -1 && indexStatut < indexActuel) {
      return false; // Les statuts précédents sont modifiables
    }
    
    // Le statut actuel est activable
    if (cmd.statut_commande === statut) {
      return false;
    }
    
    // Les statuts suivants sont désactivés (on ne peut pas sauter de statut)
    return true;
  }

  onStatutChange(statut: StatutCommande, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!this.commande()) return;

    const cmd = this.commande()!;
    const ordreEtapes: StatutCommande[] = [
      StatutCommande.EN_ATTENTE_INFORMATION,
      StatutCommande.A_MODELLISER_PREPARER,
      StatutCommande.A_GRAVER,
      StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
      StatutCommande.A_PRENDRE_EN_PHOTO,
    ];
    const statutsFinaux = [StatutCommande.A_LIVRER, StatutCommande.A_METTRE_EN_LIGNE, StatutCommande.A_FACTURER, StatutCommande.DEMANDE_AVIS];

    // Gestion du statut ANNULEE
    if (statut === StatutCommande.ANNULEE) {
      if (target.checked) {
        // Cocher ANNULEE : passer la commande au statut ANNULEE
        this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
          id_commande: cmd.id_commande,
          statut: StatutCommande.ANNULEE
        }).subscribe({
          next: () => {
            this.loadCommande(cmd.id_commande);
          },
          error: (error) => {
            console.error('Erreur lors de la mise à jour du statut:', error);
            target.checked = !target.checked; // Revert checkbox
          }
        });
      } else {
        // Décocher ANNULEE : revenir au statut précédent (par défaut EN_ATTENTE_INFORMATION)
        this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
          id_commande: cmd.id_commande,
          statut: StatutCommande.EN_ATTENTE_INFORMATION
        }).subscribe({
          next: () => {
            this.loadCommande(cmd.id_commande);
          },
          error: (error) => {
            console.error('Erreur lors de la mise à jour du statut:', error);
            target.checked = !target.checked; // Revert checkbox
          }
        });
      }
      return;
    }

    // Si la commande est annulée, on ne peut pas modifier les autres statuts
    if (cmd.statut_commande === StatutCommande.ANNULEE) {
      target.checked = false; // Revert checkbox
      return;
    }

    // Si on décoche "À Prendre en photo", décocher automatiquement tous les 4 statuts finaux
    if (!target.checked && statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
      // Décocher "À Prendre en photo" (retour à "À Prendre en photo")
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: StatutCommande.A_PRENDRE_EN_PHOTO
      }).subscribe({
        next: () => {
          this.loadCommande(cmd.id_commande);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
        }
      });
      return;
    }

    // Si on décoche une étape précédente (étape complétée)
    const indexStatut = ordreEtapes.indexOf(statut);
    const indexActuel = ordreEtapes.indexOf(cmd.statut_commande);
    const isEtapePrecedente = indexStatut !== -1 && indexActuel !== -1 && indexStatut < indexActuel;
    
    // Si on décoche un des 4 statuts finaux complétés
    if (!target.checked && statutsFinaux.includes(statut)) {
      // Quand on décoche un statut final complété, on le remet dans statuts_actifs
      // Pour cela, on doit recréer les statuts_actifs avec ce statut
      // Mais en fait, le backend gère déjà cela : décocher un statut final le remet dans statuts_actifs
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          this.loadCommande(cmd.id_commande);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
        }
      });
      return;
    }

    // Si on décoche une étape précédente (y compris si la commande est terminée)
    if (!target.checked && (isEtapePrecedente || cmd.statut_commande === StatutCommande.TERMINE)) {
      // Si la commande est terminée et qu'on décoche une étape, elle doit revenir dans "Commandes en cours"
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          this.loadCommande(cmd.id_commande);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
        }
      });
      return;
    }

    // Si on coche le statut actuel ou un statut suivant
    if (target.checked) {
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          this.loadCommande(cmd.id_commande);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', this.returnPage]);
  }

  openDeleteConfirm(): void {
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirm.set(false);
  }

  confirmDelete(): void {
    if (!this.commande()) return;

    const idCommande = this.commande()!.id_commande;
    this.isLoading.set(true);

        this.apiService.delete(`${ApiURI.DELETE_COMMANDE}/${idCommande}`).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.showDeleteConfirm.set(false);
        // Rediriger vers la page d'origine
        this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', this.returnPage]);
      },
      error: (error) => {
        console.error('Erreur lors de la suppression de la commande:', error);
        this.isLoading.set(false);
        this.showDeleteConfirm.set(false);
        alert('Erreur lors de la suppression de la commande. Veuillez réessayer.');
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  }

  toggleCouleur(couleur: Couleur): void {
    if (!this.isEditMode()) return;
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
}
