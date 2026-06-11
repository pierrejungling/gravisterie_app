import { Component, OnInit, OnDestroy, AfterViewChecked, HostListener, inject, signal, WritableSignal, computed, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { HeaderComponent, FloatingLabelInputComponent, SafeResourceUrlPipe, SafeUrlPipe, Payload } from '@shared';
import { ApiService } from '@api';
import { ApiURI, COMMANDE_FICHIERS_LIST, COMMANDE_FICHIERS_UPLOAD, COMMANDE_FICHIER_DOWNLOAD, COMMANDE_DUPLIQUER } from '@api';
import { forkJoin, Subscription } from 'rxjs';
import {
  Commande,
  CommandeFichier,
  StatutCommande,
  ModeContact,
  Couleur,
  QuantiteProduitCompteur,
  isCommandeSite,
  isCommandeSiteNonTraitee,
} from '../../model/commande.interface';
import { AppRoutes } from '@shared';
import { FraisCommissionPickerComponent } from '../../component/frais-commission-picker/frais-commission-picker.component';
import { FRAIS_COMMISSION_LIBRE } from '../../model/frais-commission.interface';
import { renderAsync } from 'docx-preview';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

@Component({
  selector: 'app-detail-commande-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent, SafeResourceUrlPipe, SafeUrlPipe, FraisCommissionPickerComponent],
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
  /** Fichiers triés : Images -> 2D (PDF/AI/SVG) -> DOC/DOCX -> 3D -> reste. */
  commandeFichiersSorted = computed(() => {
    const list = this.commandeFichiers();
    return [...list].sort((a, b) => {
      const order = (f: CommandeFichier) => {
        // 0) Images (bitmap) en premier
        if (this.isImageFichier(f) && !this.isSvgFichier(f)) return 0;
        // 1) Fichiers 2D (PDF / AI / SVG)
        if (this.isPdfFichier(f) || this.isAiFichier(f) || this.isSvgFichier(f)) return 1;
        // 2) Documents Word
        if (this.isDocxFichier(f) || this.isDocFichier(f)) return 2;
        // 3) 3D (STL / 3MF)
        if (this.is3dFichier(f)) return 3;
        // 4) le reste
        return 4;
      };

      const oa = order(a);
      const ob = order(b);
      if (oa !== ob) return oa - ob;

      // Tri secondaire: nom de fichier (stable / lisible)
      const na = (a.nom_fichier || '').toLowerCase();
      const nb = (b.nom_fichier || '').toLowerCase();
      return na.localeCompare(nb, 'fr', { sensitivity: 'base' });
    });
  });
  /** URLs d'aperçu pour les images (id_fichier -> blob URL). */
  fichierPreviewUrls: WritableSignal<Record<string, string>> = signal({});
  /** Thumbnails PDF (id_fichier -> data URL). */
  pdfThumbUrls: WritableSignal<Record<string, string>> = signal({});
  /** Thumbnails IA (AI pdf-compatible) (id_fichier -> data URL). */
  aiThumbUrls: WritableSignal<Record<string, string>> = signal({});
  /** Thumbnails 3D (id_fichier -> data URL). */
  modelThumbUrls: WritableSignal<Record<string, string>> = signal({});
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
  /** URL (blob) du fichier AI en prévisualisation (si support navigateur). */
  previewAiUrl: WritableSignal<string | null> = signal(null);
  /** Message quand un .ai n'est pas prévisualisable. */
  previewAiMessage: WritableSignal<string | null> = signal(null);
  /** Modale 3D ouverte. */
  preview3dVisible: WritableSignal<boolean> = signal(false);
  /** Type 3D courant. */
  preview3dType: WritableSignal<'stl' | '3mf' | null> = signal(null);
  copyFeedbackField: WritableSignal<string | null> = signal(null);

  private readonly allowedUploadExtensions = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.svg',
    '.ai',
    '.stl',
    '.3mf',
  ]);

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
  private readonly hostEl: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);
  private scrollKey: string = '';
  private routeSubscription?: Subscription;
  private pdfJsWorkerConfigured = false;

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
    this.configurePdfJsWorker();
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
    const aiUrl = this.previewAiUrl();
    if (aiUrl) URL.revokeObjectURL(aiUrl);
    this.dispose3d();
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
          // Auto-grow textarea (description / paiement) dès que le formulaire est en place
          setTimeout(() => this.growAllTextareas(), 0);
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

  private configurePdfJsWorker(): void {
    if (this.pdfJsWorkerConfigured) return;
    try {
      // Angular bundlera le worker via cette URL (pas besoin de copier dans /assets).
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
      this.pdfJsWorkerConfigured = true;
    } catch (e) {
      // fallback: pas bloquant, on tentera sans worker
      this.pdfJsWorkerConfigured = false;
      console.warn('PDF.js worker config failed, fallback without worker', e);
    }
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
            if (this.isPdfFichier(f)) {
              this.loadPdfThumb(idCommande, f);
            }
            if (this.isAiFichier(f)) {
              this.loadAiThumb(idCommande, f);
            }
            if (this.is3dFichier(f)) {
              this.load3dThumb(idCommande, f);
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
    this.pdfThumbUrls.set({});
    this.aiThumbUrls.set({});
    this.modelThumbUrls.set({});
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

  private loadPdfThumb(idCommande: string, fichier: CommandeFichier): void {
    // éviter de recalculer
    if (this.pdfThumbUrls()[fichier.id_fichier]) return;
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(idCommande, fichier.id_fichier)).subscribe({
      next: async (blob) => {
        try {
          const dataUrl = await this.renderPdfThumbFromBlob(blob);
          if (!dataUrl) return;
          this.pdfThumbUrls.update((m) => ({ ...m, [fichier.id_fichier]: dataUrl }));
        } catch (e) {
          console.warn('PDF thumbnail render failed', { fichier, e });
        }
      },
      error: () => {}
    });
  }

  private async renderPdfThumbFromBlob(blob: Blob): Promise<string | null> {
    try {
      const buffer = await blob.arrayBuffer();
      const data = new Uint8Array(buffer);
      const pdf = await (pdfjsLib.getDocument as any)({
        data,
        ...(this.pdfJsWorkerConfigured ? {} : { disableWorker: true }),
      }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const max = 88;
      const scale = Math.min(max / viewport.width, max / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(scaledViewport.width));
      canvas.height = Math.max(1, Math.floor(scaledViewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({ canvasContext: ctx as any, viewport: scaledViewport, intent: 'display' as any }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      try { page.cleanup(); } catch {}
      try { pdf.cleanup(); } catch {}
      try { pdf.destroy(); } catch {}
      return dataUrl;
    } catch {
      return null;
    }
  }

  private loadAiThumb(idCommande: string, fichier: CommandeFichier): void {
    if (this.aiThumbUrls()[fichier.id_fichier]) return;
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(idCommande, fichier.id_fichier)).subscribe({
      next: async (blob) => {
        try {
          const isPdf = await this.isPdfCompatibleBlob(blob);
          if (!isPdf) return; // pas de miniature pour AI non PDF-compatible
          const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
          const dataUrl = await this.renderPdfThumbFromBlob(pdfBlob);
          if (!dataUrl) return;
          this.aiThumbUrls.update((m) => ({ ...m, [fichier.id_fichier]: dataUrl }));
        } catch {
          // ignore
        }
      },
      error: () => {}
    });
  }

  private load3dThumb(idCommande: string, fichier: CommandeFichier): void {
    if (this.modelThumbUrls()[fichier.id_fichier]) return;
    const type: 'stl' | '3mf' | null = this.isStlFichier(fichier) ? 'stl' : this.is3mfFichier(fichier) ? '3mf' : null;
    if (!type) return;
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(idCommande, fichier.id_fichier)).subscribe({
      next: async (blob) => {
        try {
          const buffer = await blob.arrayBuffer();
          const dataUrl = await this.render3dThumb(buffer, type);
          if (!dataUrl) return;
          this.modelThumbUrls.update((m) => ({ ...m, [fichier.id_fichier]: dataUrl }));
        } catch {
          // ignore
        }
      },
      error: () => {}
    });
  }

  private async render3dThumb(buffer: ArrayBuffer, type: 'stl' | '3mf'): Promise<string | null> {
    // Snapshot rapide 88x88 (pas de viewer interactif ici)
    try {
      let object: THREE.Object3D | null = null;
      if (type === 'stl') {
        const geom = new STLLoader().parse(buffer);
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.08, roughness: 0.6 });
        object = new THREE.Mesh(geom, mat);
      } else {
        object = new ThreeMFLoader().parse(buffer);
      }
      if (!object) return null;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
      renderer.setSize(88, 88);
      renderer.setPixelRatio(1);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.0));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(2, 3, 4);
      scene.add(dir);

      // Centrage + cadrage
      scene.add(object);
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      object.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.7;
      camera.position.set(dist, dist, dist);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // dispose
      object.traverse((child: any) => {
        if (child?.isMesh) {
          child.geometry?.dispose?.();
          const m = child.material;
          if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
          else m?.dispose?.();
        }
      });
      renderer.dispose();
      return dataUrl;
    } catch {
      return null;
    }
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
      if (t?.startsWith('image/')) return true;
      // Mimes "classiques"
      if (t?.includes('svg')) return true;
      if (t === 'application/pdf') return true;
      if (t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
      if (t === 'application/msword') return true;
      // Mimes fréquents pour AI / fichiers 3D (selon navigateur / OS)
      if (t === 'application/postscript' || t === 'application/illustrator') return true; // .ai
      if (t === 'model/stl' || t === 'application/sla' || t === 'application/vnd.ms-pki.stl') return true; // .stl
      if (t === 'model/3mf' || t === 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml') return true; // .3mf
      // Fallback extension (type vide sur Safari / certains fichiers)
      return Array.from(this.allowedUploadExtensions).some((ext) => n.endsWith(ext));
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

  isPreviewableFichier(fichier: CommandeFichier): boolean {
    return this.isPreviewableImageFichier(fichier) ||
      this.isPdfFichier(fichier) ||
      this.isDocxFichier(fichier) ||
      this.is3dFichier(fichier) ||
      this.isAiFichier(fichier);
  }

  isPdfFichier(fichier: CommandeFichier): boolean {
    const t = fichier.type_mime?.toLowerCase();
    const nRaw = fichier.nom_fichier || '';
    const n = nRaw.toLowerCase().trim();
    // Certains backends renvoient un nom avec espaces / suffixes, donc on accepte ".pdf" n'importe où.
    const nameLooksPdf = /\.pdf(\b|$)/i.test(nRaw) || n.includes('.pdf');
    return t === 'application/pdf' || (t?.includes('pdf') ?? false) || nameLooksPdf;
  }

  getFichierExtensionLabel(fichier: CommandeFichier): string {
    const raw = (fichier.nom_fichier || '').trim();
    const m = raw.match(/\.([a-z0-9]+)(?:\s|$)/i);
    const ext = (m?.[1] || '').toLowerCase();
    if (ext) return ext.toUpperCase();

    // Fallback: dériver depuis le mime
    const t = fichier.type_mime?.toLowerCase() || '';
    if (t.includes('pdf')) return 'PDF';
    if (t.includes('svg')) return 'SVG';
    if (t.startsWith('image/')) return t.slice('image/'.length).toUpperCase();
    if (t.includes('wordprocessingml')) return 'DOCX';
    if (t === 'application/msword') return 'DOC';
    if (t.includes('stl')) return 'STL';
    if (t.includes('3mf') || t.includes('3dmanufacturing')) return '3MF';
    if (t.includes('postscript') || t.includes('illustrator')) return 'AI';
    return 'FICHIER';
  }

  getFichierExtensionClass(fichier: CommandeFichier): string {
    const label = this.getFichierExtensionLabel(fichier).toLowerCase();
    // Normalisations
    if (label === 'jpg') return 'ext-badge--jpeg';
    if (label === 'jpeg') return 'ext-badge--jpeg';
    if (label === 'png') return 'ext-badge--png';
    if (label === 'webp') return 'ext-badge--webp';
    if (label === 'gif') return 'ext-badge--gif';
    if (label === 'svg') return 'ext-badge--svg';
    if (label === 'pdf') return 'ext-badge--pdf';
    if (label === 'ai') return 'ext-badge--ai';
    if (label === 'stl') return 'ext-badge--stl';
    if (label === '3mf') return 'ext-badge--3mf';
    if (label === 'docx') return 'ext-badge--docx';
    if (label === 'doc') return 'ext-badge--doc';
    return 'ext-badge--default';
  }

  getFichierThumbBadgeClass(fichier: CommandeFichier): string {
    const label = this.getFichierExtensionLabel(fichier).toLowerCase();
    if (label === 'jpg' || label === 'jpeg') return 'fichiers-list-badge-btn--jpeg';
    if (label === 'png') return 'fichiers-list-badge-btn--png';
    if (label === 'webp') return 'fichiers-list-badge-btn--webp';
    if (label === 'gif') return 'fichiers-list-badge-btn--gif';
    if (label === 'svg') return 'fichiers-list-badge-btn--svg';
    if (label === 'pdf') return 'fichiers-list-badge-btn--pdf';
    if (label === 'ai') return 'fichiers-list-badge-btn--ai';
    if (label === 'stl') return 'fichiers-list-badge-btn--stl';
    if (label === '3mf') return 'fichiers-list-badge-btn--3mf';
    if (label === 'docx') return 'fichiers-list-badge-btn--docx';
    if (label === 'doc') return 'fichiers-list-badge-btn--doc';
    return 'fichiers-list-badge-btn--default';
  }

  isAiFichier(fichier: CommandeFichier): boolean {
    const n = (fichier.nom_fichier || '').toLowerCase();
    const t = fichier.type_mime?.toLowerCase();
    return n.endsWith('.ai') || t === 'application/illustrator' || t === 'application/postscript';
  }

  isStlFichier(fichier: CommandeFichier): boolean {
    const n = (fichier.nom_fichier || '').toLowerCase();
    const t = fichier.type_mime?.toLowerCase();
    return n.endsWith('.stl') || t === 'model/stl' || t === 'application/sla' || t === 'application/vnd.ms-pki.stl';
  }

  is3mfFichier(fichier: CommandeFichier): boolean {
    const n = (fichier.nom_fichier || '').toLowerCase();
    const t = fichier.type_mime?.toLowerCase();
    return n.endsWith('.3mf') || t === 'model/3mf' || t === 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml';
  }

  is3dFichier(fichier: CommandeFichier): boolean {
    return this.isStlFichier(fichier) || this.is3mfFichier(fichier);
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

  openPreviewForFichier(fichier: CommandeFichier): void {
    if (this.isPreviewableImageFichier(fichier)) {
      this.openPreview(fichier);
      return;
    }
    if (this.isPdfFichier(fichier)) {
      this.openPreviewPdf(fichier);
      return;
    }
    if (this.isDocxFichier(fichier)) {
      this.openPreviewDocx(fichier);
      return;
    }
    if (this.is3dFichier(fichier)) {
      this.openPreview3d(fichier);
      return;
    }
    if (this.isAiFichier(fichier)) {
      this.openPreviewAi(fichier);
      return;
    }
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

  openPreviewAi(fichier: CommandeFichier): void {
    const id = this.commande()?.id_commande;
    if (!id || !this.isAiFichier(fichier)) return;

    const currentAi = this.previewAiUrl();
    if (currentAi) URL.revokeObjectURL(currentAi);
    const currentPdf = this.previewPdfUrl();
    if (currentPdf) URL.revokeObjectURL(currentPdf);

    this.previewImageUrl.set(null);
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
    this.preview3dVisible.set(false);
    this.preview3dType.set(null);
    this.dispose3d();
    this.previewAiUrl.set(null);
    this.previewAiMessage.set(null);
    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(id, fichier.id_fichier)).subscribe({
      next: (blob) => {
        this.isPdfCompatibleBlob(blob).then((isPdf) => {
          // Beaucoup de .ai sont “PDF-compatible” → on les affiche comme PDF (beaucoup plus fiable)
          if (isPdf) {
            const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
            const url = URL.createObjectURL(pdfBlob);
            this.previewPdfUrl.set(url);
            this.previewAiUrl.set(null);
            this.previewAiMessage.set(null);
          } else {
            /**
             * Un .ai non PDF-compatible n'est pas fiable en preview navigateur (souvent page blanche ou téléchargement).
             * On n'essaie donc PAS d'iframe: on affiche un message.
             */
            this.previewAiUrl.set(null);
            this.previewAiMessage.set('Aperçu non disponible pour ce fichier .ai. Exporte-le en PDF ou SVG pour le prévisualiser.');
          }
        }).catch((err) => {
          console.error('Erreur analyse AI:', err);
          this.previewAiUrl.set(null);
          this.previewAiMessage.set('Aperçu non disponible pour ce fichier .ai. Exporte-le en PDF ou SVG pour le prévisualiser.');
        });
      },
      error: (err) => console.error('Erreur chargement AI:', err)
    });
  }

  private async isPdfCompatibleBlob(blob: Blob): Promise<boolean> {
    try {
      const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      // "%PDF-"
      return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46 && header[4] === 0x2d;
    } catch {
      return false;
    }
  }

  openPreview3d(fichier: CommandeFichier): void {
    const id = this.commande()?.id_commande;
    if (!id || !this.is3dFichier(fichier)) return;

    this.previewImageUrl.set(null);
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
    const currentAi = this.previewAiUrl();
    if (currentAi) URL.revokeObjectURL(currentAi);
    this.previewAiUrl.set(null);

    this.preview3dVisible.set(true);
    this.preview3dType.set(this.isStlFichier(fichier) ? 'stl' : '3mf');

    this.apiService.getBlob(COMMANDE_FICHIER_DOWNLOAD(id, fichier.id_fichier)).subscribe({
      next: (blob) => {
        blob.arrayBuffer().then((buffer) => {
          this.render3d(buffer, this.preview3dType());
        }).catch((err) => console.error('Erreur lecture fichier 3D:', err));
      },
      error: (err) => console.error('Erreur chargement fichier 3D:', err)
    });
  }

  closePreview(): void {
    const pdfUrl = this.previewPdfUrl();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    const aiUrl = this.previewAiUrl();
    if (aiUrl) URL.revokeObjectURL(aiUrl);
    this.previewImageUrl.set(null);
    this.previewPdfUrl.set(null);
    this.previewDocxBlob.set(null);
    this.previewAiUrl.set(null);
    this.previewAiMessage.set(null);
    this.preview3dVisible.set(false);
    this.preview3dType.set(null);
    this.dispose3d();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.previewImageUrl() || this.previewPdfUrl() || this.previewDocxBlob() || this.previewAiUrl() || this.previewAiMessage() || this.preview3dVisible()) {
      this.closePreview();
    }
  }

  private threeRenderer: THREE.WebGLRenderer | null = null;
  private threeScene: THREE.Scene | null = null;
  private threeCamera: THREE.PerspectiveCamera | null = null;
  private threeControls: OrbitControls | null = null;
  private threeAnimId: number | null = null;
  private threeObject: THREE.Object3D | null = null;

  private dispose3d(): void {
    if (this.threeAnimId != null) {
      cancelAnimationFrame(this.threeAnimId);
      this.threeAnimId = null;
    }
    this.threeControls?.dispose();
    this.threeControls = null;

    if (this.threeScene && this.threeObject) {
      this.threeScene.remove(this.threeObject);
    }

    const disposeMesh = (obj: THREE.Object3D) => {
      obj.traverse((child: any) => {
        if (child && child.isMesh) {
          if (child.geometry) child.geometry.dispose?.();
          const m = child.material;
          if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
          else m?.dispose?.();
        }
      });
    };
    if (this.threeObject) disposeMesh(this.threeObject);
    this.threeObject = null;

    if (this.threeRenderer) {
      try {
        this.threeRenderer.dispose();
      } catch {}
      const canvas = this.threeRenderer.domElement;
      if (canvas && canvas.parentElement) canvas.parentElement.removeChild(canvas);
    }

    this.threeRenderer = null;
    this.threeScene = null;
    this.threeCamera = null;
  }

  private render3d(buffer: ArrayBuffer, type: 'stl' | '3mf' | null): void {
    if (!type) return;
    // Attendre que le container existe (Angular *ngIf)
    setTimeout(() => {
      const container = document.getElementById('model-3d-preview-container');
      if (!container) return;

      this.dispose3d();

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f172a); // bleu très foncé

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
      camera.position.set(0.8, 0.8, 0.8);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      // Lumières
      const hemi = new THREE.HemisphereLight(0xffffff, 0x334155, 1.0);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 1.1);
      dir.position.set(2, 3, 4);
      scene.add(dir);

      let object: THREE.Object3D | null = null;
      try {
        if (type === 'stl') {
          const geom = new STLLoader().parse(buffer);
          geom.computeVertexNormals();
          const mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.1, roughness: 0.6 });
          const mesh = new THREE.Mesh(geom, mat);
          object = mesh;
        } else {
          object = new ThreeMFLoader().parse(buffer);
        }
      } catch (e) {
        console.error('Erreur parse 3D:', e);
        return;
      }
      if (!object) return;

      // Centrer & cadrer
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      object.position.sub(center);
      scene.add(object);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const dist = maxDim * 1.6;
      camera.position.set(dist, dist, dist);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      const animate = () => {
        this.threeAnimId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Persist refs pour dispose/fermeture
      this.threeScene = scene;
      this.threeCamera = camera;
      this.threeRenderer = renderer;
      this.threeControls = controls;
      this.threeObject = object;

      // Resize
      const onResize = () => {
        const c = document.getElementById('model-3d-preview-container');
        if (!c || !this.threeRenderer || !this.threeCamera) return;
        const w = c.clientWidth || 800;
        const h = c.clientHeight || 600;
        this.threeCamera.aspect = w / h;
        this.threeCamera.updateProjectionMatrix();
        this.threeRenderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize, { passive: true });
      // Petit cleanup quand on ferme: on supprime le listener via dispose3d en recréant renderer (OK),
      // mais pour éviter les leaks, on enlève le listener dès fermeture via closePreview (dispose3d).
      // Ici on garde le handler capturé; on le retire explicitement lors du prochain dispose.
      const prevDispose = this.dispose3d.bind(this);
      this.dispose3d = () => {
        window.removeEventListener('resize', onResize as any);
        prevDispose();
      };
    }, 0);
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
      quantite_produit_compteurs: this.buildQuantiteProduitCompteursFormArray(cmd),
      prix_final: new FormControl({ value: cmd.prix_final ?? '', disabled: !isEdit }),
      prix_unitaire_final: new FormControl({ value: cmd.prix_unitaire_final ?? (cmd.prix_final !== null && cmd.prix_final !== undefined && cmd.quantité ? cmd.prix_final / cmd.quantité : ''), disabled: !isEdit }),
      frais_commission_selection: new FormControl({
        value: cmd.frais_commission_id || (cmd.frais_commission_libelle || cmd.frais_pourcentage != null ? FRAIS_COMMISSION_LIBRE : null),
        disabled: !isEdit,
      }),
      frais_commission_id: new FormControl({ value: cmd.frais_commission_id ?? null, disabled: !isEdit }),
      frais_commission_libelle: new FormControl({ value: cmd.frais_commission_libelle ?? null, disabled: !isEdit }),
      frais_pourcentage: new FormControl({ value: cmd.frais_pourcentage ?? null, disabled: !isEdit }),
      montant_frais: new FormControl({ value: 0, disabled: true }),
      montant_net: new FormControl({ value: 0, disabled: true }),
      payé: new FormControl(cmd.payé || false), // Toujours modifiable
      commentaire_paye: new FormControl({ value: cmd.commentaire_paye || '', disabled: !isEdit }),
      attente_reponse: new FormControl(cmd.attente_reponse ?? false), // Toujours modifiable (exception)
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
      const prixFinalV = this.formGroup.get('prix_final')?.value;
      const prixUnitaireV = this.formGroup.get('prix_unitaire_final')?.value;
      if (prixFinalV) {
        isCalculatingPU = true;
        this.recalculatePrixUnitaireFromFinal();
        isCalculatingPU = false;
      } else if (prixUnitaireV) {
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
      this.updateVenteFraisComputedFields();
    });
    
    this.formGroup.get('prix_unitaire_final')?.valueChanges.subscribe(() => {
      if (isCalculatingPF || isCalculatingPU) return;
      isCalculatingPF = true;
      this.recalculatePrixFinalFromUnitaire();
      isCalculatingPF = false;
    });

    // Recalculer les montants de frais/net en cas de modification du pourcentage de frais
    this.formGroup.get('frais_pourcentage')?.valueChanges.subscribe(() => {
      this.updateVenteFraisComputedFields();
    });
    
    // Calcul initial : si prix_final existe, calculer PU, sinon si PU existe, calculer PF
    const prixFinal = this.formGroup.get('prix_final')?.value;
    const prixUnitaireInit = this.formGroup.get('prix_unitaire_final')?.value;
    if (prixFinal) {
      this.recalculatePrixUnitaireFromFinal();
    } else if (prixUnitaireInit) {
      this.recalculatePrixFinalFromUnitaire();
    }
    
    // Toujours recalculer les supports et bénéfice à l'initialisation pour s'assurer que les valeurs sont correctes
    // même en mode lecture et même si le prix final est 0
    this.recalculateSupportsAndBenefice();
    this.updateVenteFraisComputedFields();
    this.refreshQuantiteProduitCompteursStructureControls();

    // Auto-grow textarea en lecture/édition (au cas où le contenu est long)
    setTimeout(() => this.growAllTextareas(), 0);
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
    const actif = support.actif !== undefined ? support.actif : true;
    
    const group = new FormGroup({
      nom_support: new FormControl({ value: support.nom_support || '', disabled: !isEdit }),
      prix_support: new FormControl({ value: prixSupport, disabled: !isEdit }),
      url_support: new FormControl({ value: support.url_support || '', disabled: !isEdit }),
      prix_unitaire: new FormControl({ value: prixUnitaire, disabled: !isEdit }),
      nombre_unites: new FormControl({ value: nombreUnites, disabled: !isEdit || prixUnitaire }),
      prix_support_unitaire: new FormControl({ value: prixSupportUnitaire, disabled: true }), // Read-only, calculé
      actif: new FormControl({ value: actif, disabled: !isEdit })
    });

    // Écouter les changements pour recalculer
    group.get('prix_support')?.valueChanges.subscribe(() => this.recalculateSupportUnitaire(group));
    group.get('nombre_unites')?.valueChanges.subscribe(() => this.recalculateSupportUnitaire(group));
    group.get('actif')?.valueChanges.subscribe(() => this.recalculateSupportsAndBenefice());
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
      const actif = supportGroup.get('actif')?.value !== false;
      if (!actif) return;
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

  getFraisPourcentageValue(): number {
    if (!this.formGroup) return 0;
    const raw = this.formGroup.get('frais_pourcentage')?.value;
    if (raw === null || raw === undefined || raw === '') return 0;
    const parsed = parseFloat(String(raw));
    return isNaN(parsed) ? 0 : parsed;
  }

  getFraisCommissionDisplayValue(): string {
    if (!this.formGroup) return '-';
    const libelle = this.formGroup.get('frais_commission_libelle')?.value;
    const pourcentage = this.formGroup.get('frais_pourcentage')?.value;
    if (!libelle && (pourcentage === null || pourcentage === undefined || pourcentage === '')) {
      return '-';
    }
    const pct = pourcentage !== null && pourcentage !== undefined && pourcentage !== ''
      ? `${pourcentage} %`
      : '';
    if (libelle && pct) return `${libelle} (${pct})`;
    return libelle || pct || '-';
  }

  getMontantFraisVente(): number {
    if (!this.formGroup) return 0;
    const prixFinalRaw = this.formGroup.get('prix_final')?.value;
    const prixFinal = prixFinalRaw !== null && prixFinalRaw !== undefined && prixFinalRaw !== '' ? parseFloat(String(prixFinalRaw)) || 0 : 0;
    const pourcentage = this.getFraisPourcentageValue();
    return prixFinal * (pourcentage / 100);
  }

  getMontantNetVente(): number {
    if (!this.formGroup) return 0;
    const prixFinalRaw = this.formGroup.get('prix_final')?.value;
    const prixFinal = prixFinalRaw !== null && prixFinalRaw !== undefined && prixFinalRaw !== '' ? parseFloat(String(prixFinalRaw)) || 0 : 0;
    const montantFrais = this.getMontantFraisVente();
    return prixFinal - montantFrais;
  }

  private updateVenteFraisComputedFields(): void {
    if (!this.formGroup) return;
    if (!this.isVente()) {
      this.formGroup.get('montant_frais')?.setValue(0, { emitEvent: false });
      this.formGroup.get('montant_net')?.setValue(0, { emitEvent: false });
      return;
    }

    const montantFrais = this.getMontantFraisVente();
    const montantNet = this.getMontantNetVente();

    this.formGroup.get('montant_frais')?.setValue(montantFrais.toFixed(2), { emitEvent: false });
    this.formGroup.get('montant_net')?.setValue(montantNet.toFixed(2), { emitEvent: false });
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

  // Helper pour vérifier si le support est actif (inclus dans le tableau Détails des frais)
  isSupportActif(supportGroup: FormGroup): boolean {
    return supportGroup.get('actif')?.value !== false;
  }

  getSupportsActifsCount(): number {
    if (!this.supportsFormArray) return 0;
    return this.supportsFormArray.controls.filter((c) => this.isSupportActif(c as FormGroup)).length;
  }

  private newCompteurClientId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
  }

  /** Lignes de compteurs depuis la commande API (toujours au moins une ligne pour l’UI). */
  denormaliserCompteursDepuisCmd(cmd: Commande): QuantiteProduitCompteur[] {
    const stored = cmd.quantite_produit_compteurs;
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map((s) => {
        let cible = parseInt(String(s.quantite_cible ?? 1), 10);
        let realise = parseInt(String(s.quantite_realisee ?? 0), 10);
        if (!Number.isFinite(cible) || cible < 1) cible = 1;
        if (!Number.isFinite(realise)) realise = 0;
        if (realise < 0) realise = 0;
        return {
          id: typeof s.id === 'string' && s.id.trim() ? s.id : this.newCompteurClientId(),
          libelle: typeof s.libelle === 'string' ? s.libelle : '',
          quantite_cible: cible,
          quantite_realisee: realise,
        };
      });
    }
    const qGlobale = Math.max(1, cmd.quantité ?? 1);
    let realise = parseInt(String(cmd.quantite_realisee ?? 0), 10);
    if (!Number.isFinite(realise)) realise = 0;
    if (realise < 0) realise = 0;
    return [
      {
        id: this.newCompteurClientId(),
        libelle: '',
        quantite_cible: qGlobale,
        quantite_realisee: realise,
      },
    ];
  }

  createCompteurFormGroup(row: QuantiteProduitCompteur): FormGroup {
    const finitionLocked = this.isStatutFinitionCompleted();
    const structureLocked = finitionLocked || !this.isEditMode();

    return new FormGroup({
      id: new FormControl(row.id),
      libelle: new FormControl({ value: row.libelle, disabled: structureLocked }),
      quantite_cible: new FormControl({ value: row.quantite_cible, disabled: structureLocked }),
      quantite_realisee: new FormControl({ value: row.quantite_realisee, disabled: finitionLocked }),
    });
  }

  buildQuantiteProduitCompteursFormArray(cmd: Commande): FormArray<FormGroup> {
    const rows = this.denormaliserCompteursDepuisCmd(cmd);
    return new FormArray<FormGroup>(rows.map((r) => this.createCompteurFormGroup(r)));
  }

  /**
   * Après création du form ou entrée en mode édition : libellé/objectif suivent le mode édition ;
   * réalisé reste pilotable hors édition (sauf finition terminée).
   */
  refreshQuantiteProduitCompteursStructureControls(): void {
    const finitionLocked = this.isStatutFinitionCompleted();
    const structureLocked = finitionLocked || !this.isEditMode();
    const fa = this.formGroup?.get('quantite_produit_compteurs') as FormArray<FormGroup>;
    if (!fa) return;
    fa.controls.forEach((ctrl) => {
      const g = ctrl as FormGroup;
      ['libelle', 'quantite_cible'].forEach((key) => {
        const c = g.get(key);
        if (!c) return;
        if (structureLocked) c.disable({ emitEvent: false });
        else c.enable({ emitEvent: false });
      });
      const r = g.get('quantite_realisee');
      if (!r) return;
      if (finitionLocked) r.disable({ emitEvent: false });
      else r.enable({ emitEvent: false });
    });
  }
  get quantiteProduitCompteursFormArray(): FormArray<FormGroup> {
    return this.formGroup.get('quantite_produit_compteurs') as FormArray<FormGroup>;
  }

  getCompteurGroup(index: number): FormGroup {
    return this.quantiteProduitCompteursFormArray.at(index) as FormGroup;
  }

  compteurLibelleLectureText(index: number): string {
    const raw = this.getCompteurGroup(index).get('libelle')?.value;
    const t = typeof raw === 'string' ? raw.trim() : '';
    return t.length ? t : 'Sans libellé';
  }

  compteurCibleAffiche(index: number): number {
    const raw = this.getCompteurGroup(index).get('quantite_cible')?.value;
    const n = parseInt(String(raw ?? 1), 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }

  compteurRealiseAffiche(index: number): number {
    const raw = this.getCompteurGroup(index).get('quantite_realisee')?.value;
    const n = parseInt(String(raw ?? 0), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  /** Quantité restante à produire pour ce compteur (objectif − réalisé, min. 0). */
  compteurQuantiteRestante(index: number): number {
    return Math.max(0, this.compteurCibleAffiche(index) - this.compteurRealiseAffiche(index));
  }

  /** Réalisé ≥ objectif (tolère les valeurs en cours de saisie tant qu’elles sont cohérentes). */
  compteurQuantiteComplete(index: number): boolean {
    const g = this.getCompteurGroup(index);
    let cible = parseInt(String(g.get('quantite_cible')?.value ?? 1), 10);
    let realise = parseInt(String(g.get('quantite_realisee')?.value ?? 0), 10);
    if (!Number.isFinite(cible) || cible < 1) cible = 1;
    if (!Number.isFinite(realise)) realise = 0;
    if (realise < 0) realise = 0;
    return realise >= cible;
  }

  /** Pourcentage 0–100 pour la barre de progression (réalisé / objectif). */
  compteurProgressPercent(index: number): number {
    const cible = this.compteurCibleAffiche(index);
    const realise = Math.max(0, this.compteurRealiseAffiche(index));
    const base = cible >= 1 ? cible : 1;
    return Math.min(100, Math.round((realise / base) * 100));
  }

  /** Valuemax ARIA réaliste lorsque réalisé > objectif (ex. 55 / 50). */
  compteurProgressAriaMax(index: number): number {
    return Math.max(this.compteurRealiseAffiche(index), this.compteurCibleAffiche(index));
  }

  private clampCompteurFormGroup(g: FormGroup): void {
    let cible = parseInt(String(g.get('quantite_cible')?.value ?? 1), 10);
    let realise = parseInt(String(g.get('quantite_realisee')?.value ?? 0), 10);
    if (!Number.isFinite(cible) || cible < 1) cible = 1;
    if (!Number.isFinite(realise)) realise = 0;
    if (realise < 0) realise = 0;
    g.patchValue({ quantite_cible: cible, quantite_realisee: realise }, { emitEvent: false });
  }

  private clampAllCompteursForm(): void {
    const fa = this.quantiteProduitCompteursFormArray;
    if (!fa) return;
    fa.controls.forEach((c) => this.clampCompteurFormGroup(c as FormGroup));
  }

  /** Serialisation pour l’API (getRawValue pour inclure id). */
  private serializeCompteursPourApi(): QuantiteProduitCompteur[] {
    const fa = this.quantiteProduitCompteursFormArray;
    if (!fa) return [];
    return fa.getRawValue().map((raw: Record<string, unknown>) => ({
      id: typeof raw['id'] === 'string' && String(raw['id']).trim() ? String(raw['id']).trim() : this.newCompteurClientId(),
      libelle: typeof raw['libelle'] === 'string' ? raw['libelle'] : '',
      quantite_cible: Math.max(1, parseInt(String(raw['quantite_cible'] ?? 1), 10) || 1),
      quantite_realisee: Math.max(0, parseInt(String(raw['quantite_realisee'] ?? 0), 10) || 0),
    }));
  }

  private deriveQuantiteRealiseeSomme(rows: QuantiteProduitCompteur[]): number {
    return rows.reduce((acc, r) => acc + Math.max(0, r.quantite_realisee), 0);
  }

  persistQuantiteProduitCompteurs(): void {
    if (!this.commande() || !this.formGroup || !this.isQuantiteRealiseeEditable()) return;

    const id = this.commande()!.id_commande;
    const currentCmd = this.commande()!;
    const prevCompteurs = currentCmd.quantite_produit_compteurs;
    const prevQte = currentCmd.quantite_realisee ?? 0;

    this.clampAllCompteursForm();
    const rows = this.serializeCompteursPourApi();
    const sumRealise = this.deriveQuantiteRealiseeSomme(rows);

    this.commande.set({
      ...currentCmd,
      quantite_produit_compteurs: rows,
      quantite_realisee: sumRealise,
    });

    const payload: Record<string, unknown> = {
      quantite_produit_compteurs: rows.length > 0 ? rows : null,
      quantite_realisee: sumRealise,
    };

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {},
      error: (error: unknown) => {
        console.error('Erreur lors de la mise à jour des compteurs quantité produite:', error);
        this.commande.set({
          ...currentCmd,
          quantite_produit_compteurs: prevCompteurs ?? null,
          quantite_realisee: prevQte,
        });
        this.initForm();
      },
    });
  }

  incrementCompteur(index: number): void {
    if (!this.quantiteProduitCompteursFormArray || !this.isQuantiteRealiseeEditable()) return;
    const g = this.quantiteProduitCompteursFormArray.at(index) as FormGroup;
    let current = parseInt(String(g.get('quantite_realisee')?.value || 0), 10) || 0;
    current += 1;
    g.get('quantite_realisee')?.setValue(current, { emitEvent: false });
    this.persistQuantiteProduitCompteurs();
  }

  decrementCompteur(index: number): void {
    if (!this.quantiteProduitCompteursFormArray || !this.isQuantiteRealiseeEditable()) return;
    const g = this.quantiteProduitCompteursFormArray.at(index) as FormGroup;
    let current = parseInt(String(g.get('quantite_realisee')?.value || 0), 10) || 0;
    if (current > 0) {
      current -= 1;
      g.get('quantite_realisee')?.setValue(current, { emitEvent: false });
    }
    this.persistQuantiteProduitCompteurs();
  }

  addCompteurFromInput(index: number, addValue: number): void {
    if (!this.formGroup || !this.isQuantiteRealiseeEditable() || !this.quantiteProduitCompteursFormArray) return;
    const g = this.quantiteProduitCompteursFormArray.at(index) as FormGroup;
    const toAdd = Number(addValue);
    if (!Number.isFinite(toAdd) || toAdd === 0) return;

    let current = parseInt(String(g.get('quantite_realisee')?.value ?? 0), 10) || 0;
    let next = current + toAdd;
    if (next < 0) next = 0;
    g.get('quantite_realisee')?.setValue(next, { emitEvent: false });
    this.persistQuantiteProduitCompteurs();
  }

  onCompteurRealiseOuCibleInputChange(): void {
    if (!this.isQuantiteRealiseeEditable()) return;
    this.persistQuantiteProduitCompteurs();
  }

  onCompteurLibelleBlur(): void {
    if (!this.isQuantiteRealiseeEditable() || !this.isEditMode()) return;
    this.persistQuantiteProduitCompteurs();
  }

  ajouterCompteurQuantiteProduit(): void {
    if (!this.quantiteProduitCompteursFormArray || !this.isQuantiteRealiseeEditable() || !this.isEditMode()) return;
    const row: QuantiteProduitCompteur = {
      id: this.newCompteurClientId(),
      libelle: '',
      quantite_cible: 1,
      quantite_realisee: 0,
    };
    const g = this.createCompteurFormGroup(row);
    this.quantiteProduitCompteursFormArray.push(g);
    this.persistQuantiteProduitCompteurs();
  }

  supprimerCompteurQuantiteProduit(index: number): void {
    if (
      !this.quantiteProduitCompteursFormArray ||
      this.quantiteProduitCompteursFormArray.length < 2 ||
      !this.isQuantiteRealiseeEditable() ||
      !this.isEditMode()
    ) {
      return;
    }
    this.quantiteProduitCompteursFormArray.removeAt(index);
    this.persistQuantiteProduitCompteurs();
  }

  toggleEditMode(): void {
    const newEditMode = !this.isEditMode();
    this.isEditMode.set(newEditMode);

    // Si on quitte le mode édition via le bouton de la barre (✕ Annuler),
    // on réinitialise complètement le formulaire avec les dernières données
    // de la commande (qui incluent déjà les exceptions sauvegardées en live).
    if (!newEditMode) {
      this.initForm();
      return;
    }

    // Désactiver/activer tous les FormControls selon le mode édition
    if (this.formGroup) {
      const controlsToDisable = [
        'nom_commande', 'date_commande', 'deadline', 'description', 'dimensions', 'quantité', 'commentaire_paye',
        'support', 'couleur', 'police_ecriture', 'texte_personnalisation', 'prix_unitaire_final', 'prix_final',
        'frais_commission_selection', 'frais_commission_id', 'frais_commission_libelle', 'frais_pourcentage',
        'prix_support', 'url_support', 'nom', 'prenom', 'telephone', 'mail',
        'rue', 'code_postal', 'ville', 'pays', 'societe', 'tva', 'mode_contact'
      ];
      
      // Gérer les supports dans le FormArray
      const supportsArray = this.formGroup.get('supports') as FormArray;
      supportsArray.controls.forEach((supportControl) => {
        const supportGroup = supportControl as FormGroup;
        ['nom_support', 'prix_support', 'url_support', 'prix_unitaire', 'nombre_unites', 'actif'].forEach(controlName => {
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
        this.refreshQuantiteProduitCompteursStructureControls();
      }
    }

    if (newEditMode) {
      // Une fois les textareas affichés dans le DOM, ajuster leur hauteur au contenu existant
      setTimeout(() => this.growAllTextareas(), 0);
    }
  }

  autoGrowTextarea(event: Event): void {
    const el = event.target as HTMLTextAreaElement | null;
    if (!el) return;
    this.growTextarea(el);
  }

  private growAllTextareas(): void {
    const root = this.hostEl?.nativeElement;
    if (!root) return;
    const nodes = root.querySelectorAll<HTMLTextAreaElement>(
      'textarea.description-textarea, textarea.paye-commentaire-input'
    );
    nodes.forEach((el) => this.growTextarea(el));
  }

  private growTextarea(el: HTMLTextAreaElement): void {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }

  togglePrixFields(): void {
    this.showPrixFields.set(!this.showPrixFields());
  }

  onSave(): void {
    if (!this.formGroup.valid || !this.commande()) return;

    this.clampAllCompteursForm();
    const compteursSerialises = this.serializeCompteursPourApi();
    const quantiteRealiseeSomme = this.deriveQuantiteRealiseeSomme(compteursSerialises);

    const formValue = this.formGroup.getRawValue();
    const payload: any = {
      produit: formValue.nom_commande,
      date_commande: formValue.date_commande || null,
      deadline: formValue.deadline || null,
      description: formValue.description,
      quantité: formValue.quantité ? parseInt(formValue.quantité, 10) : null,
      quantite_realisee: quantiteRealiseeSomme,
      quantite_produit_compteurs: compteursSerialises.length > 0 ? compteursSerialises : null,
      payé: formValue.payé || false,
      commentaire_paye: formValue.commentaire_paye || null,
      attente_reponse: formValue.attente_reponse ?? false,
      mode_contact: formValue.mode_contact || null,
      prix_final: formValue.prix_final !== null && formValue.prix_final !== undefined && formValue.prix_final !== '' ? parseFloat(String(formValue.prix_final)) : null,
      prix_unitaire_final: formValue.prix_unitaire_final !== null && formValue.prix_unitaire_final !== undefined && formValue.prix_unitaire_final !== '' ? parseFloat(String(formValue.prix_unitaire_final)) : null,
      frais_pourcentage: formValue.frais_pourcentage !== null && formValue.frais_pourcentage !== undefined && formValue.frais_pourcentage !== '' ? parseFloat(String(formValue.frais_pourcentage)) : null,
      frais_commission_id: formValue.frais_commission_id || null,
      frais_commission_libelle: formValue.frais_commission_libelle?.trim() || null,
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
              actif: s.actif !== undefined ? Boolean(s.actif) : true,
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
      quantite_realisee: quantiteRealiseeSomme,
      quantite_produit_compteurs: compteursSerialises.length > 0 ? compteursSerialises : null,
      payé: formValue.payé || false,
      commentaire_paye: formValue.commentaire_paye || undefined,
      attente_reponse: formValue.attente_reponse ?? false,
      mode_contact: formValue.mode_contact || undefined,
      prix_final: formValue.prix_final !== null && formValue.prix_final !== undefined && formValue.prix_final !== '' ? parseFloat(String(formValue.prix_final)) : undefined,
      prix_unitaire_final: formValue.prix_unitaire_final !== null && formValue.prix_unitaire_final !== undefined && formValue.prix_unitaire_final !== '' ? parseFloat(String(formValue.prix_unitaire_final)) : undefined,
      frais_pourcentage: formValue.frais_pourcentage !== null && formValue.frais_pourcentage !== undefined && formValue.frais_pourcentage !== '' ? parseFloat(String(formValue.frais_pourcentage)) : undefined,
      frais_commission_id: formValue.frais_commission_id || null,
      frais_commission_libelle: formValue.frais_commission_libelle?.trim() || undefined,
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
              actif: s.actif !== undefined ? Boolean(s.actif) : true,
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
    // Recharger complètement la commande depuis l'API pour annuler
    // TOUTES les modifications non enregistrées sur les champs "classiques".
    const current = this.commande();
    if (current?.id_commande) {
      this.isEditMode.set(false);
      this.loadCommande(current.id_commande);
      return;
    }

    // Fallback : si aucune commande n'est chargée, on se contente de réinitialiser le formulaire.
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

  afficherNotifCommandeSite(): boolean {
    const commande = this.commande();
    if (!commande || this.isVente()) {
      return false;
    }
    return commande.statut_commande === StatutCommande.EN_ATTENTE_INFORMATION
      && isCommandeSiteNonTraitee(commande);
  }

  onMarquerSiteTraitee(): void {
    const currentCommande = this.commande();
    if (!currentCommande || !this.afficherNotifCommandeSite()) {
      return;
    }

    const payload: Partial<Commande> = { site_traitee: true };
    if (isCommandeSite(currentCommande) && !currentCommande.source_web) {
      payload.source_web = true;
    }

    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${currentCommande.id_commande}`, payload).subscribe({
      next: () => {
        this.commande.set({
          ...currentCommande,
          site_traitee: true,
          source_web: currentCommande.source_web || isCommandeSite(currentCommande),
        });
      },
      error: (error) => {
        console.error('Erreur lors du marquage de la commande site comme traitée:', error);
      },
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
          /**
           * À la validation de la finition : harmoniser les compteurs avec l’objectif
           * si encore en retard, sans jamais baisser un déjà dépassé (ex. 55/50 inchangé).
           */
          if (statut === StatutCommande.A_FINIR_LAVER_ASSEMBLER_PEINDRE) {
            const baseCmd = this.commande()!;
            const lignesExist = baseCmd.quantite_produit_compteurs && baseCmd.quantite_produit_compteurs.length > 0;
            if (lignesExist) {
              const newCompteurs = (baseCmd.quantite_produit_compteurs as QuantiteProduitCompteur[]).map((c) => {
                let cible = parseInt(String(c.quantite_cible ?? 1), 10);
                let realise = parseInt(String(c.quantite_realisee ?? 0), 10);
                if (!Number.isFinite(cible) || cible < 1) cible = 1;
                if (!Number.isFinite(realise)) realise = 0;
                if (realise < 0) realise = 0;
                return {
                  ...c,
                  quantite_realisee: Math.max(realise, cible),
                };
              });
              const sommeRealise = this.deriveQuantiteRealiseeSomme(newCompteurs);
              updateLocalCommande({
                quantite_produit_compteurs: newCompteurs,
                quantite_realisee: sommeRealise,
              });
              this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${cmd.id_commande}`, {
                quantite_produit_compteurs: newCompteurs,
                quantite_realisee: sommeRealise,
              }).subscribe({
                next: () => {},
                error: (err: unknown) => {
                  console.error('Erreur mise à jour quantité produite (finition):', err);
                  updateLocalCommande({
                    quantite_produit_compteurs: baseCmd.quantite_produit_compteurs,
                    quantite_realisee: baseCmd.quantite_realisee ?? 0,
                  });
                },
              });
            } else {
              const qteTotale = cmd.quantité ?? 1;
              updateLocalCommande({
                quantite_realisee: qteTotale,
              });
              this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${cmd.id_commande}`, {
                quantite_realisee: qteTotale,
              }).subscribe({
                next: () => {},
                error: (err: unknown) => {
                  console.error('Erreur mise à jour quantité réalisée:', err);
                  updateLocalCommande({
                    quantite_realisee: cmd.quantite_realisee ?? 0,
                  });
                },
              });
            }
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
