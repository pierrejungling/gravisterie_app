import { Component, OnInit, OnDestroy, AfterViewChecked, HostListener, inject, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { HeaderComponent, FloatingLabelInputComponent, SafeResourceUrlPipe, SafeUrlPipe, Payload } from '@shared';
import { ApiService } from '@api';
import { ApiURI, COMMANDE_FICHIERS_LIST, COMMANDE_FICHIERS_UPLOAD, COMMANDE_FICHIER_DOWNLOAD, COMMANDE_DUPLIQUER } from '@api';
import { forkJoin, Subscription } from 'rxjs';
import { Commande, CommandeFichier, StatutCommande, ModeContact, Couleur } from '../../model/commande.interface';
import { AppRoutes } from '@shared';
import { renderAsync } from 'docx-preview';

@Component({
  selector: 'app-detail-commande-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent, SafeResourceUrlPipe, SafeUrlPipe],
  templateUrl: './detail-commande-page.component.html',
  styleUrl: './detail-commande-page.component.scss'
})
export class DetailCommandePageComponent implements OnInit, OnDestroy, AfterViewChecked {
  commande: WritableSignal<Commande | null> = signal(null);
  isLoading: WritableSignal<boolean> = signal(false);
  isEditMode: WritableSignal<boolean> = signal(false);
  showPrixFields: WritableSignal<boolean> = signal(false);
  showDeleteConfirm: WritableSignal<boolean> = signal(false);
  isDuplicating: WritableSignal<boolean> = signal(false);
  duplicateConfirmVisible: WritableSignal<boolean> = signal(false);
  duplicateSuccessVisible: WritableSignal<boolean> = signal(false);
  duplicatedCommandeId: WritableSignal<string | null> = signal(null);
  returnPage: string = 'en-cours'; // Page par défaut pour le retour
  private scrollRestored: boolean = false;
  private isInitialLoad: boolean = true; // Flag pour distinguer le chargement initial

  /** Fichiers joints à la commande (métadonnées). */
  commandeFichiers: WritableSignal<CommandeFichier[]> = signal([]);
  /** Fichiers triés : images d'abord, puis PDF, puis le reste. */
  commandeFichiersSorted = computed(() => {
    const list = this.commandeFichiers();
    return [...list].sort((a, b) => {
      const order = (f: CommandeFichier) =>
        this.isPreviewableImageFichier(f) ? 0 : this.isPdfFichier(f) ? 1 : 2;
      return order(a) - order(b);
    });
  });
  /** URLs d'aperçu pour les images (id_fichier -> blob URL). */
  fichierPreviewUrls: WritableSignal<Record<string, string>> = signal({});
  /** Upload en cours. */
  fichierUploading: WritableSignal<boolean> = signal(false);
  /** Drag over la zone d'upload. */
  isDragOver: WritableSignal<boolean> = signal(false);
  /** URL de l'image en prévisualisation (null = modal fermée). */
  previewImageUrl: WritableSignal<string | null> = signal(null);
  /** URL du PDF en prévisualisation (null = modal fermée). */
  previewPdfUrl: WritableSignal<string | null> = signal(null);
  /** Blob du DOCX en prévisualisation (null = modal fermée). */
  previewDocxBlob: WritableSignal<Blob | null> = signal(null);
  copyFeedbackField: WritableSignal<string | null> = signal(null);

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

  private readonly ventePrefix = 'Vente | ';
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private scrollKey: string = '';
  private routeSubscription?: Subscription;

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

  isCommandeTerminee(): boolean {
    return this.commande()?.statut_commande === StatutCommande.TERMINE;
  }

  isCommandeAnnulee(): boolean {
    return this.commande()?.statut_commande === StatutCommande.ANNULEE;
  }

  isVente(): boolean {
    const produit = this.commande()?.produit || '';
    return produit.trimStart().startsWith(this.ventePrefix);
  }

  canDuplicateCommande(): boolean {
    const cmd = this.commande();
    if (!cmd) return false;
    return cmd.statut_commande !== StatutCommande.ANNULEE;
  }

  private readonly detailReturnPageKey = 'detail-return-page';

  ngOnInit(): void {
    try {
      const stored = sessionStorage.getItem(this.detailReturnPageKey);
      this.returnPage = stored === 'terminees' ? 'terminees' : 'en-cours';
    } catch {
      this.returnPage = 'en-cours';
    }
    
    // Sauvegarder la position de scroll avant le rechargement
    window.addEventListener('beforeunload', this.saveScrollPosition);

    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) return;
      // Créer une clé unique pour cette commande
      this.scrollKey = `detail-commande-${id}-scroll`;
      // Réinitialiser l'état de scroll pour la nouvelle commande
      this.scrollRestored = false;
      this.isInitialLoad = true;
      this.loadCommande(id);
    });
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
      if (attempts > 20) {
        // Arrêter après 20 tentatives (augmenté pour Safari)
        this.scrollRestored = true;
        this.isInitialLoad = false;
        return;
      }

      requestAnimationFrame(() => {
        // Vérifier que le document est prêt
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          // Essayer différentes méthodes de scroll pour compatibilité Safari
          // Safari nécessite parfois plusieurs tentatives avec différentes méthodes
          window.scrollTo({
            top: scrollPosition,
            left: 0,
            behavior: 'auto' // 'auto' au lieu de 'smooth' pour Safari
          });
          document.documentElement.scrollTop = scrollPosition;
          document.body.scrollTop = scrollPosition;
          
          // Pour Safari iOS, essayer aussi avec scrollIntoView si possible
          if (scrollPosition > 0) {
            const firstElement = document.body.firstElementChild;
            if (firstElement) {
              try {
                firstElement.scrollTop = scrollPosition;
              } catch (e) {
                // Ignorer les erreurs
              }
            }
          }

          // Vérifier si le scroll a fonctionné (avec une marge d'erreur de 5px)
          // Utiliser setTimeout pour laisser Safari appliquer le scroll
          setTimeout(() => {
            const currentScroll = this.getCurrentScrollPosition();
            
            if (Math.abs(currentScroll - scrollPosition) <= 5) {
              this.scrollRestored = true;
              this.isInitialLoad = false;
            } else {
              // Réessayer après un court délai (délai augmenté pour Safari)
              setTimeout(() => attemptScroll(attempts + 1), 100);
            }
          }, 50);
        } else {
          // Attendre que le document soit prêt
          setTimeout(() => attemptScroll(attempts + 1), 100);
        }
      });
    };

    // Commencer la restauration après un délai initial (augmenté pour Safari)
    setTimeout(() => attemptScroll(), 150);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.saveScrollPosition);
    this.routeSubscription?.unsubscribe();
    this.revokeFichierPreviewUrls();
    const pdfUrl = this.previewPdfUrl();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }

  private saveScrollPosition = (): void => {
    if (this.scrollKey) {
      sessionStorage.setItem(this.scrollKey, this.getCurrentScrollPosition().toString());
    }
  }

  private getCurrentScrollPosition(): number {
    // Méthode compatible avec tous les navigateurs, y compris Safari
    return window.pageYOffset || 
           document.documentElement.scrollTop || 
           document.body.scrollTop || 
           (window.scrollY !== undefined ? window.scrollY : 0);
  }

  loadCommande(id: string): void {
    this.isLoading.set(true);
    this.apiService.get(`${ApiURI.GET_COMMANDE_BY_ID}/${id}`).subscribe({
      next: (response) => {
        if (response.result && response.data) {
          this.commande.set(response.data);
          try {
            const statut = (response.data as Commande).statut_commande;
            const returnPage = statut === StatutCommande.TERMINE || statut === StatutCommande.ANNULEE
              ? 'terminees'
              : 'en-cours';
            sessionStorage.setItem(this.detailReturnPageKey, returnPage);
          } catch {
            // ignorer
          }
          this.initForm();
          this.loadFichiers(id);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la commande:', error);
        this.isLoading.set(false);
      }
    });
  }

  loadFichiers(idCommande: string): void {
    this.apiService.get(COMMANDE_FICHIERS_LIST(idCommande)).subscribe({
      next: (response) => {
        if (response.result && Array.isArray(response.data)) {
          this.revokeFichierPreviewUrls();
          this.commandeFichiers.set(response.data);
          (response.data as CommandeFichier[]).forEach((f) => {
            if (f.type_mime?.startsWith('image/') || this.isSvgFichier(f)) {
              this.loadFichierPreview(idCommande, f);
            }
          });
        } else {
          this.commandeFichiers.set([]);
        }
      },
      error: () => this.commandeFichiers.set([])
    });
  }

  private revokeFichierPreviewUrls(): void {
    const urls = this.fichierPreviewUrls();
    Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    this.fichierPreviewUrls.set({});
  }

  private loadFichierPreview(idCommande: string, fichier: CommandeFichier): void {
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(idCommande, fichier.id_fichier)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.fichierPreviewUrls.update((m) => ({ ...m, [fichier.id_fichier]: url }));
      },
      error: () => {}
    });
  }

  downloadFichier(fichier: CommandeFichier): void {
    const id = this.commande()?.id_commande;
    if (!id) return;
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(id, fichier.id_fichier)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fichier.nom_fichier || 'fichier';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Erreur téléchargement:', err)
    });
  }

  deleteFichier(idFichier: string): void {
    const id = this.commande()?.id_commande;
    if (!id) return;
    this.apiService.delete(`commande/${id}/fichiers/${idFichier}`).subscribe({
      next: (response) => {
        if (response.result) {
          this.loadFichiers(id);
        }
      },
      error: (err) => console.error('Erreur suppression fichier:', err)
    });
  }

  onFichierSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length === 0) return;
    this.uploadFiles(files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter((file) => {
      const t = file.type?.toLowerCase();
      const n = file.name?.toLowerCase() ?? '';
      return t?.startsWith('image/') || t?.includes('svg') || t === 'application/pdf' ||
        t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || t === 'application/msword' ||
        n.endsWith('.pdf') || n.endsWith('.doc') || n.endsWith('.docx') || n.endsWith('.svg');
    });
    if (accepted.length > 0) this.uploadFiles(accepted);
  }

  private uploadFiles(files: File[]): void {
    const id = this.commande()?.id_commande;
    if (!id) return;
    this.fichierUploading.set(true);
    const uploads = files.map((file) => {
      const formData = new FormData();
      formData.append('file', file);
      return this.apiService.postFormData(COMMANDE_FICHIERS_UPLOAD(id), formData);
    });
    forkJoin(uploads).subscribe({
      next: () => {
        this.fichierUploading.set(false);
        this.loadFichiers(id);
      },
      error: () => {
        this.fichierUploading.set(false);
        this.loadFichiers(id);
      }
    });
  }

  isImageFichier(fichier: CommandeFichier): boolean {
    return !!fichier.type_mime?.startsWith('image/');
  }

  /** SVG (image/svg+xml ou autres types courants) pour miniature et prévisualisation. */
  isSvgFichier(fichier: CommandeFichier): boolean {
    const t = fichier.type_mime?.toLowerCase();
    return t === 'image/svg+xml' || t === 'image/svg' || (t?.includes('svg') ?? false);
  }

  /** Fichier prévisualisable comme image (bitmap ou SVG). */
  isPreviewableImageFichier(fichier: CommandeFichier): boolean {
    return this.isImageFichier(fichier) || this.isSvgFichier(fichier);
  }

  isPdfFichier(fichier: CommandeFichier): boolean {
    return fichier.type_mime === 'application/pdf';
  }

  /** DOCX (Word récent) : prévisualisation via docx-preview. */
  isDocxFichier(fichier: CommandeFichier): boolean {
    const t = fichier.type_mime?.toLowerCase();
    return t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (t?.includes('wordprocessingml') ?? false);
  }

  /** DOC (Word ancien) : pas de prévisualisation intégrée, téléchargement uniquement. */
  isDocFichier(fichier: CommandeFichier): boolean {
    return fichier.type_mime === 'application/msword';
  }

  openPreview(fichier: CommandeFichier): void {
    if (!this.isPreviewableImageFichier(fichier)) return;
    const url = this.fichierPreviewUrls()[fichier.id_fichier];
    if (url) this.previewImageUrl.set(url);
  }

  openPreviewPdf(fichier: CommandeFichier): void {
    const id = this.commande()?.id_commande;
    if (!id) return;
    const current = this.previewPdfUrl();
    if (current) URL.revokeObjectURL(current);
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(id, fichier.id_fichier)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.previewPdfUrl.set(url);
      },
      error: (err) => console.error('Erreur chargement PDF:', err)
    });
  }

  openPreviewDocx(fichier: CommandeFichier): void {
    const id = this.commande()?.id_commande;
    if (!id || !this.isDocxFichier(fichier)) return;
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(id, fichier.id_fichier)).subscribe({
      next: (blob) => {
        this.previewDocxBlob.set(blob);
        setTimeout(() => this.renderDocxPreview(blob), 50);
      },
      error: (err) => console.error('Erreur chargement DOCX:', err)
    });
  }

  private renderDocxPreview(blob: Blob): void {
    const el = document.getElementById('docx-preview-container');
    if (!el) return;
    el.innerHTML = '';
    renderAsync(blob, el).catch((err) => console.error('Erreur rendu DOCX:', err));
  }

  closePreview(): void {
    const pdfUrl = this.previewPdfUrl();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    this.previewImageUrl.set(null);
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewImageUrl() || this.previewPdfUrl() || this.previewDocxBlob()) {
      this.closePreview();
    }
  }

  initForm(): void {
    const cmd = this.commande();
    if (!cmd) return;

    const isEdit = this.isEditMode();
    
    this.formGroup = new FormGroup({
      nom_commande: new FormControl({ value: cmd.produit || '', disabled: !isEdit }, [Validators.required]),
      date_commande: new FormControl({ value: cmd.date_commande ? cmd.date_commande.split('T')[0] : '', disabled: !isEdit }),
      deadline: new FormControl({ value: cmd.deadline ? cmd.deadline.split('T')[0] : '', disabled: !isEdit }),
      description: new FormControl({ value: cmd.description || '', disabled: !isEdit }),
      dimensions: new FormControl({ value: cmd.gravure?.dimensions || '', disabled: !isEdit }),
      couleur: new FormControl({ value: Array.isArray(cmd.personnalisation?.couleur) ? cmd.personnalisation.couleur : [], disabled: !isEdit }),
      support: new FormControl({ value: cmd.support?.nom_support || '', disabled: !isEdit }),
      police_ecriture: new FormControl({ value: cmd.personnalisation?.police || '', disabled: !isEdit }),
      texte_personnalisation: new FormControl({ value: cmd.personnalisation?.texte || '', disabled: !isEdit }),
      quantité: new FormControl({ value: cmd.quantité || 1, disabled: !isEdit }),
      quantite_realisee: new FormControl({
        value: cmd.quantite_realisee ?? 0,
        disabled: this.isStatutFinitionCompleted()
      }),
      prix_final: new FormControl({ value: cmd.prix_final ?? '', disabled: !isEdit }),
      prix_unitaire_final: new FormControl({ value: cmd.prix_unitaire_final ?? (cmd.prix_final !== null && cmd.prix_final !== undefined && cmd.quantité ? cmd.prix_final / cmd.quantité : ''), disabled: !isEdit }),
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
      societe: new FormControl({ value: cmd.client.société || '', disabled: !isEdit }),
      telephone: new FormControl({ value: cmd.client.téléphone || '', disabled: !isEdit }),
      mail: new FormControl({ value: cmd.client.mail || '', disabled: !isEdit }, [Validators.email]),
      // Adresse décomposée
      rue: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 0) || '', disabled: !isEdit }),
      code_postal: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 1) || '', disabled: !isEdit }),
      ville: new FormControl({ value: this.extractAdressePart(cmd.client.adresse, 2) || '', disabled: !isEdit }),
      pays: new FormControl({
        value: this.extractAdressePart(cmd.client.adresse, 3) || (this.hasAdresseDetails(cmd.client.adresse) ? 'Belgique' : ''),
        disabled: !isEdit
      }),
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
    
    // Toujours recalculer les supports et bénéfice à l'initialisation pour s'assurer que les valeurs sont correctes
    // même en mode lecture et même si le prix final est 0
    this.recalculateSupportsAndBenefice();
  }

  extractAdressePart(adresse: string | null | undefined, index: number): string {
    if (!adresse) return '';
    const parts = adresse.split(',').map(p => p.trim());
    // Compatibilité anciennes données: "Belgique" seule => pays uniquement.
    if (parts.length === 1 && parts[0].toLowerCase() === 'belgique') {
      return index === 3 ? parts[0] : '';
    }
    return parts[index] || '';
  }

  hasAdresseDetails(adresse: string | null | undefined): boolean {
    if (!adresse) return false;
    const parts = adresse.split(',').map((p) => p.trim());
    const rue = parts[0] || '';
    const codePostal = parts[1] || '';
    const ville = parts[2] || '';
    return Boolean(rue || codePostal || ville);
  }

  buildAdresseComplete(rue?: string, codePostal?: string, ville?: string, pays?: string): string | null {
    const rueTrim = rue?.trim() ?? '';
    const codePostalTrim = codePostal?.trim() ?? '';
    const villeTrim = ville?.trim() ?? '';
    const paysTrim = pays?.trim() ?? '';

    const parts: string[] = [];
    if (rueTrim) parts.push(rueTrim);
    if (codePostalTrim) parts.push(codePostalTrim);
    if (villeTrim) parts.push(villeTrim);
    if (paysTrim) parts.push(paysTrim);
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
    
    const prixFinalValue = this.formGroup.get('prix_final')?.value;
    const quantiteValue = this.formGroup.get('quantité')?.value;
    // Utiliser parseFloat avec gestion des valeurs null/undefined/chaînes vides
    const prixFinal = prixFinalValue !== null && prixFinalValue !== undefined && prixFinalValue !== '' 
      ? parseFloat(String(prixFinalValue)) || 0 
      : 0;
    const quantite = quantiteValue !== null && quantiteValue !== undefined && quantiteValue !== '' 
      ? parseFloat(String(quantiteValue)) || 1 
      : 1;
    
    // Calculer prix final des supports
    const supportsArray = this.formGroup.get('supports') as FormArray;
    let prixFinalSupportsUnitaires = 0; // Somme des prix unitaires (sans multiplier par quantité)
    let prixFinalSupports = 0; // Somme des prix unitaires * quantité
    
    supportsArray.controls.forEach((supportControl) => {
      const supportGroup = supportControl as FormGroup;
      const prixSupportUnitaireValue = supportGroup.get('prix_support_unitaire')?.value;
      const prixSupportUnitaire = prixSupportUnitaireValue !== null && prixSupportUnitaireValue !== undefined && prixSupportUnitaireValue !== ''
        ? parseFloat(String(prixSupportUnitaireValue)) || 0
        : 0;
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

  getPrixBeneficeValue(): number {
    if (!this.formGroup) return 0;
    const rawValue = this.formGroup.get('prix_benefice')?.value;
    // Gérer correctement les valeurs null, undefined, chaînes vides et valeurs négatives
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return 0;
    }
    const parsed = parseFloat(String(rawValue));
    // parseFloat retourne NaN si la conversion échoue, on retourne 0 dans ce cas
    return isNaN(parsed) ? 0 : parsed;
  }

  isPrixBeneficeNegatif(): boolean {
    return this.getPrixBeneficeValue() < 0;
  }

  getPrixBeneficeDisplayValue(): number {
    return Math.abs(this.getPrixBeneficeValue());
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
        'nom_commande', 'date_commande', 'deadline', 'description', 'dimensions', 'quantité', 'commentaire_paye',
        'support', 'couleur', 'police_ecriture', 'texte_personnalisation', 'prix_unitaire_final', 'prix_final',
        'prix_support', 'url_support', 'nom', 'prenom', 'telephone', 'mail',
        'rue', 'code_postal', 'ville', 'pays', 'societe', 'tva', 'mode_contact'
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
      date_commande: formValue.date_commande || null,
      deadline: formValue.deadline || null,
      description: formValue.description,
      quantité: formValue.quantité ? parseInt(formValue.quantité, 10) : null,
      quantite_realisee: formValue.quantite_realisee !== null && formValue.quantite_realisee !== undefined && formValue.quantite_realisee !== '' ? parseInt(String(formValue.quantite_realisee), 10) : 0,
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
        societe: formValue.societe,
        tva: formValue.tva,
      },
      support: {
        nom_support: formValue.support,
        prix_support: formValue.prix_support ? parseFloat(formValue.prix_support) : undefined,
        url_support: formValue.url_support || undefined,
      },
      supports: formValue.supports && Array.isArray(formValue.supports) 
        ? formValue.supports
            .filter((s: any) => s && (s.nom_support || s.prix_support || s.url_support)) // Filtrer les supports complètement vides
            .map((s: any) => ({
              nom_support: s.nom_support || undefined,
              prix_support: s.prix_support !== null && s.prix_support !== undefined && s.prix_support !== '' ? parseFloat(String(s.prix_support)) : undefined,
              url_support: s.url_support || undefined,
              prix_unitaire: s.prix_unitaire !== undefined ? Boolean(s.prix_unitaire) : true,
              nombre_unites: s.nombre_unites !== null && s.nombre_unites !== undefined && s.nombre_unites !== '' ? parseInt(String(s.nombre_unites), 10) : undefined,
              prix_support_unitaire: s.prix_support_unitaire !== null && s.prix_support_unitaire !== undefined && s.prix_support_unitaire !== '' ? parseFloat(String(s.prix_support_unitaire)) : undefined,
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
    const currentCommande = this.commande()!;
    
    // Mettre à jour localement immédiatement avec les nouvelles valeurs du formulaire
    this.commande.set({
      ...currentCommande,
      produit: formValue.nom_commande,
      date_commande: formValue.date_commande || undefined,
      deadline: formValue.deadline || undefined,
      description: formValue.description,
      quantité: formValue.quantité ? parseInt(formValue.quantité, 10) : undefined,
      quantite_realisee: formValue.quantite_realisee !== null && formValue.quantite_realisee !== undefined && formValue.quantite_realisee !== '' ? parseInt(String(formValue.quantite_realisee), 10) : 0,
      payé: formValue.payé || false,
      commentaire_paye: formValue.commentaire_paye || undefined,
      attente_reponse: formValue.attente_reponse ?? false,
      mode_contact: formValue.mode_contact || undefined,
      prix_final: formValue.prix_final !== null && formValue.prix_final !== undefined && formValue.prix_final !== '' ? parseFloat(String(formValue.prix_final)) : undefined,
      prix_unitaire_final: formValue.prix_unitaire_final !== null && formValue.prix_unitaire_final !== undefined && formValue.prix_unitaire_final !== '' ? parseFloat(String(formValue.prix_unitaire_final)) : undefined,
      client: {
        ...currentCommande.client,
        nom: formValue.nom,
        prénom: formValue.prenom,
        société: formValue.societe,
        téléphone: formValue.telephone,
        mail: formValue.mail,
        adresse: this.buildAdresseComplete(formValue.rue, formValue.code_postal, formValue.ville, formValue.pays) || undefined,
        tva: formValue.tva,
      },
      support: formValue.support ? {
        nom_support: formValue.support,
        prix_support: formValue.prix_support ? parseFloat(formValue.prix_support) : undefined,
        url_support: formValue.url_support || undefined,
      } : undefined,
      supports: formValue.supports && Array.isArray(formValue.supports) 
        ? formValue.supports
            .filter((s: any) => s && (s.nom_support || s.prix_support || s.url_support))
            .map((s: any) => ({
              nom_support: s.nom_support || undefined,
              prix_support: s.prix_support !== null && s.prix_support !== undefined && s.prix_support !== '' ? parseFloat(String(s.prix_support)) : undefined,
              url_support: s.url_support || undefined,
              prix_unitaire: s.prix_unitaire !== undefined ? Boolean(s.prix_unitaire) : true,
              nombre_unites: s.nombre_unites !== null && s.nombre_unites !== undefined && s.nombre_unites !== '' ? parseInt(String(s.nombre_unites), 10) : undefined,
              prix_support_unitaire: s.prix_support_unitaire !== null && s.prix_support_unitaire !== undefined && s.prix_support_unitaire !== '' ? parseFloat(String(s.prix_support_unitaire)) : undefined,
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
    });
    
    // Réinitialiser le formulaire avec les nouvelles valeurs
    this.initForm();
    this.isEditMode.set(false);
    
    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: (response) => {
        // Mise à jour réussie, les données locales sont déjà à jour
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour:', error);
        // En cas d'erreur, restaurer l'état précédent
        this.commande.set(currentCommande);
        this.initForm();
        this.isEditMode.set(true); // Remettre en mode édition pour permettre de réessayer
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
    const commentairePaye = this.formGroup.get('commentaire_paye')?.value || undefined;

    // Mettre à jour localement immédiatement
    const currentCommande = this.commande()!;
    this.commande.set({
      ...currentCommande,
      payé: payeValue,
      commentaire_paye: commentairePaye?.trim() || undefined
    });

    // Envoyer uniquement les champs payé et commentaire_paye
    const payload: any = {
      payé: payeValue,
      commentaire_paye: commentairePaye?.trim() || null,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
        // Mise à jour réussie, les données locales sont déjà à jour
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut payé:', error);
        // En cas d'erreur, restaurer les valeurs précédentes
        this.commande.set({
          ...currentCommande,
          payé: currentCommande.payé || false,
          commentaire_paye: currentCommande.commentaire_paye || undefined
        });
        this.formGroup.get('payé')?.setValue(!payeValue, { emitEvent: false });
      }
    });
  }

  incrementQuantiteRealisee(): void {
    const max = parseInt(this.formGroup.get('quantité')?.value || '1', 10) || 1;
    const current = parseInt(this.formGroup.get('quantite_realisee')?.value || '0', 10) || 0;
    const next = Math.min(current + 1, max);
    this.formGroup.get('quantite_realisee')?.setValue(next, { emitEvent: false });
    this.onQuantiteRealiseeChange();
  }

  decrementQuantiteRealisee(): void {
    const current = parseInt(this.formGroup.get('quantite_realisee')?.value || '0', 10) || 0;
    const next = Math.max(current - 1, 0);
    this.formGroup.get('quantite_realisee')?.setValue(next, { emitEvent: false });
    this.onQuantiteRealiseeChange();
  }

  onQuantiteRealiseeChange(): void {
    if (!this.commande()) return;

    const id = this.commande()!.id_commande;
    const raw = this.formGroup.get('quantite_realisee')?.value;
    const quantiteTotale = parseInt(this.formGroup.get('quantité')?.value || '1', 10) || 1;
    let val = raw !== null && raw !== undefined && raw !== '' ? parseInt(String(raw), 10) : 0;
    if (isNaN(val) || val < 0) val = 0;
    if (val > quantiteTotale) val = quantiteTotale;

    // Mettre à jour localement immédiatement
    const currentCommande = this.commande()!;
    this.commande.set({
      ...currentCommande,
      quantite_realisee: val
    });

    const payload: any = {
      quantite_realisee: val,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
        // Mise à jour réussie, les données locales sont déjà à jour
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour des PCs réalisés:', error);
        // En cas d'erreur, restaurer la valeur précédente
        this.commande.set({
          ...currentCommande,
          quantite_realisee: currentCommande.quantite_realisee ?? 0
        });
        this.formGroup.get('quantite_realisee')?.setValue(currentCommande.quantite_realisee ?? 0, { emitEvent: false });
      }
    });
  }

  onAttenteReponseChange(): void {
    if (!this.commande()) return;

    const id = this.commande()!.id_commande;
    const attenteReponseValue = this.formGroup.get('attente_reponse')?.value ?? false;

    // Mettre à jour localement immédiatement
    const currentCommande = this.commande()!;
    this.commande.set({
      ...currentCommande,
      attente_reponse: attenteReponseValue
    });

    // Envoyer uniquement le champ attente_reponse
    const payload: any = {
      attente_reponse: attenteReponseValue,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
        // Mise à jour réussie, les données locales sont déjà à jour
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour de l\'attente réponse:', error);
        // En cas d'erreur, restaurer la valeur précédente
        this.commande.set({
          ...currentCommande,
          attente_reponse: currentCommande.attente_reponse ?? false
        });
        this.formGroup.get('attente_reponse')?.setValue(!attenteReponseValue, { emitEvent: false });
      }
    });
  }

  isStatutFinitionCompleted(): boolean {
    return this.isStatutChecked(StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE);
  }

  isQuantiteRealiseeEditable(): boolean {
    return !this.isStatutFinitionCompleted();
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
    const ordreEtapes: StatutCommande[] = [
      StatutCommande.EN_ATTENTE_INFORMATION,
      StatutCommande.A_MODELLISER_PREPARER,
      StatutCommande.A_GRAVER,
      StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE,
      StatutCommande.A_PRENDRE_EN_PHOTO,
    ];
    
    // Pour les 4 statuts finaux : ils sont cochés seulement quand ils sont complétés
    // Si un statut final est dans statuts_actifs, c'est qu'il est actif mais pas encore complété (donc pas coché)
    if (statutsFinaux.includes(statut)) {
      // Un statut final est coché seulement s'il n'est PAS dans statuts_actifs (il a été complété)
      return cmd.statuts_actifs ? !cmd.statuts_actifs.includes(statut) : false;
    }
    
    // Si on est dans les colonnes finales (statuts_actifs existe), toutes les étapes précédentes sont complétées
    const isInStatutsFinaux = statutsFinaux.some(s => cmd.statuts_actifs?.includes(s));
    
    if (isInStatutsFinaux) {
      // Toutes les étapes jusqu'à "À Prendre en photo" inclus sont complétées
      const indexStatutInOrdre = ordreEtapes.indexOf(statut);
      if (indexStatutInOrdre !== -1 && indexStatutInOrdre <= ordreEtapes.indexOf(StatutCommande.A_PRENDRE_EN_PHOTO)) {
        return true;
      }
    }
    
    // Pour les autres statuts, vérifier si c'est une étape précédente (complétée)
    const indexStatut = ordreEtapes.indexOf(statut);
    const indexActuel = ordreEtapes.indexOf(cmd.statut_commande);
    
    // Si le statut demandé est une étape précédente, elle est complétée (cochée)
    if (indexStatut !== -1 && indexActuel !== -1 && indexStatut < indexActuel) {
      return true;
    }
    
    // "À Prendre en photo" est complétée si les statuts finaux sont créés (statuts_actifs existe)
    if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
      // Si statuts_actifs existe, "À Prendre en photo" est complétée
      return isInStatutsFinaux;
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

    // Fonction helper pour mettre à jour localement
    const updateLocalCommande = (updates: Partial<Commande>) => {
      const currentCmd = this.commande()!;
      this.commande.set({
        ...currentCmd,
        ...updates
      });
      // Réinitialiser le formulaire pour refléter les changements
      this.initForm();
    };

    // Gestion du statut ANNULEE
    if (statut === StatutCommande.ANNULEE) {
      if (target.checked) {
        // Cocher ANNULEE : passer la commande au statut ANNULEE
        updateLocalCommande({
          statut_commande: StatutCommande.ANNULEE,
          statuts_actifs: undefined
        });
        
        this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
          id_commande: cmd.id_commande,
          statut: StatutCommande.ANNULEE
        }).subscribe({
          next: () => {
            // Mise à jour réussie, les données locales sont déjà à jour
          },
          error: (error) => {
            console.error('Erreur lors de la mise à jour du statut:', error);
            target.checked = !target.checked; // Revert checkbox
            // Restaurer l'état précédent
            this.commande.set(cmd);
            this.initForm();
          }
        });
      } else {
        // Décocher ANNULEE : revenir au statut précédent (par défaut EN_ATTENTE_INFORMATION)
        updateLocalCommande({
          statut_commande: StatutCommande.EN_ATTENTE_INFORMATION
        });
        
        this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
          id_commande: cmd.id_commande,
          statut: StatutCommande.EN_ATTENTE_INFORMATION
        }).subscribe({
          next: () => {
            // Mise à jour réussie, les données locales sont déjà à jour
          },
          error: (error) => {
            console.error('Erreur lors de la mise à jour du statut:', error);
            target.checked = !target.checked; // Revert checkbox
            // Restaurer l'état précédent
            this.commande.set(cmd);
            this.initForm();
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
      updateLocalCommande({
        statut_commande: StatutCommande.A_PRENDRE_EN_PHOTO,
        statuts_actifs: undefined
      });
      
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: StatutCommande.A_PRENDRE_EN_PHOTO
      }).subscribe({
        next: () => {
          // Mise à jour réussie, les données locales sont déjà à jour
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
          // Restaurer l'état précédent
          this.commande.set(cmd);
          this.initForm();
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
      const currentStatutsActifs = cmd.statuts_actifs || [];
      const newStatutsActifs = currentStatutsActifs.includes(statut) 
        ? currentStatutsActifs 
        : [...currentStatutsActifs, statut];
      
      updateLocalCommande({
        statuts_actifs: newStatutsActifs.length > 0 ? newStatutsActifs : undefined
      });
      
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          // Mise à jour réussie, les données locales sont déjà à jour
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
          // Restaurer l'état précédent
          this.commande.set(cmd);
          this.initForm();
        }
      });
      return;
    }

    // Si on décoche une étape précédente (y compris si la commande est terminée)
    if (!target.checked && (isEtapePrecedente || cmd.statut_commande === StatutCommande.TERMINE)) {
      // Si la commande est terminée et qu'on décoche une étape, elle doit revenir dans "Commandes en cours"
      updateLocalCommande({
        statut_commande: statut,
        statuts_actifs: undefined
      });
      
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          // Mise à jour réussie, les données locales sont déjà à jour
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
          // Restaurer l'état précédent
          this.commande.set(cmd);
          this.initForm();
        }
      });
      return;
    }

    // Si on coche le statut actuel ou un statut suivant
    if (target.checked) {
      // Mettre à jour localement selon le type de statut
      if (statutsFinaux.includes(statut)) {
        // Pour les statuts finaux : retirer de statuts_actifs (marquer comme terminé)
        const currentCmd = this.commande()!;
        const currentStatutsActifs = currentCmd.statuts_actifs || [];
        const newStatutsActifs = currentStatutsActifs.filter(s => s !== statut);
        
        // Si tous les statuts finaux sont complétés, passer la commande à TERMINE
        if (newStatutsActifs.length === 0) {
          updateLocalCommande({
            statut_commande: StatutCommande.TERMINE,
            statuts_actifs: undefined
          });
        } else {
          updateLocalCommande({
            statuts_actifs: newStatutsActifs
          });
        }
      } else {
        // Pour les autres statuts : passer au statut suivant dans l'ordre
        const currentIndex = ordreEtapes.indexOf(statut);
        if (currentIndex !== -1 && currentIndex < ordreEtapes.length - 1) {
          // Passer au statut suivant
          const nextStatut = ordreEtapes[currentIndex + 1];
          updateLocalCommande({
            statut_commande: nextStatut
          });
        } else if (statut === StatutCommande.A_PRENDRE_EN_PHOTO) {
          // Si on termine "À Prendre en photo", créer statuts_actifs avec les 4 statuts finaux
          updateLocalCommande({
            statut_commande: statut,
            statuts_actifs: [...statutsFinaux]
          });
        } else {
          // Pour les autres cas, mettre à jour le statut directement
          updateLocalCommande({
            statut_commande: statut
          });
        }
      }
      
      this.apiService.put(ApiURI.UPDATE_STATUT_COMMANDE, {
        id_commande: cmd.id_commande,
        statut: statut
      }).subscribe({
        next: () => {
          // Si on a fini la finition : compléter automatiquement le compteur quantité réalisée au max
          if (statut === StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE) {
            const qteTotale = cmd.quantité ?? 1;
            const updatedCommande = this.commande()!;
            updateLocalCommande({
              quantite_realisee: qteTotale
            });
            
            this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${cmd.id_commande}`, {
              quantite_realisee: qteTotale
            }).subscribe({
              next: () => {
                // Mise à jour réussie, les données locales sont déjà à jour
              },
              error: (err) => {
                console.error('Erreur mise à jour quantité réalisée:', err);
                // Restaurer la quantité précédente
                updateLocalCommande({
                  quantite_realisee: cmd.quantite_realisee ?? 0
                });
              }
            });
          }
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          target.checked = !target.checked; // Revert checkbox
          // Restaurer l'état précédent
          this.commande.set(cmd);
          this.initForm();
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

  duplicateCommande(): void {
    if (!this.canDuplicateCommande() || this.isDuplicating()) return;
    this.duplicateConfirmVisible.set(true);
  }

  closeDuplicateConfirm(): void {
    this.duplicateConfirmVisible.set(false);
  }

  confirmDuplicate(): void {
    const cmd = this.commande();
    if (!cmd || !this.canDuplicateCommande() || this.isDuplicating()) return;
    this.duplicateConfirmVisible.set(false);
    this.isDuplicating.set(true);
    this.apiService.post(COMMANDE_DUPLIQUER(cmd.id_commande), {} as Payload).subscribe({
      next: (response) => {
        if (response.result && response.data?.id_commande) {
          this.duplicatedCommandeId.set(response.data.id_commande);
          this.duplicateSuccessVisible.set(true);
        }
        this.isDuplicating.set(false);
      },
      error: (error) => {
        console.error('Erreur lors de la duplication de la commande:', error);
        this.isDuplicating.set(false);
        alert('Erreur lors de la duplication. Veuillez réessayer.');
      }
    });
  }

  closeDuplicateSuccess(): void {
    this.duplicateSuccessVisible.set(false);
  }

  viewDuplicatedCommande(): void {
    const id = this.duplicatedCommandeId();
    if (!id) return;
    try {
      sessionStorage.setItem(this.detailReturnPageKey, 'en-cours');
    } catch {}
    this.duplicateSuccessVisible.set(false);
    this.router.navigate([AppRoutes.AUTHENTICATED, 'commandes', 'detail', id]);
  }

  showDuplicateConfirm(): boolean {
    return this.duplicateConfirmVisible();
  }

  showDuplicateSuccess(): boolean {
    return this.duplicateSuccessVisible();
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

  getFieldDisplayValue(controlName: string): string {
    const value = this.get(controlName)?.value;
    if (value === null || value === undefined) return '-';
    const text = String(value).trim();
    return text.length > 0 ? text : '-';
  }

  copyFieldValue(controlName: string): void {
    const value = this.get(controlName)?.value;
    const textToCopy = value === null || value === undefined ? '' : String(value).trim();
    if (!textToCopy) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => this.showCopyFeedback(controlName))
        .catch(() => this.copyWithFallback(textToCopy, controlName));
      return;
    }

    this.copyWithFallback(textToCopy, controlName);
  }

  copyTextValue(text: string, feedbackKey: string): void {
    const textToCopy = text?.trim();
    if (!textToCopy) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => this.showCopyFeedback(feedbackKey))
        .catch(() => this.copyWithFallback(textToCopy, feedbackKey));
      return;
    }

    this.copyWithFallback(textToCopy, feedbackKey);
  }

  toCopyText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  openExternalUrl(value: unknown): void {
    const raw = this.toCopyText(value).trim();
    if (!raw) return;

    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const parsed = new URL(withProtocol);
      window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      // URL invalide: ne rien faire
    }
  }

  private copyWithFallback(text: string, controlName: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (copied) this.showCopyFeedback(controlName);
  }

  private showCopyFeedback(controlName: string): void {
    this.copyFeedbackField.set(controlName);
    window.setTimeout(() => {
      if (this.copyFeedbackField() === controlName) {
        this.copyFeedbackField.set(null);
      }
    }, 1200);
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
