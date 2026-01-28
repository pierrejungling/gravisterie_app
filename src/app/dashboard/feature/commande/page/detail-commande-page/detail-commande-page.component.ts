import { Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HeaderComponent, FloatingLabelInputComponent } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { Commande, StatutCommande } from '../../model/commande.interface';
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
  
  // Exposer StatutCommande pour l'utiliser dans le template
  readonly StatutCommande = StatutCommande;
  
  private readonly apiService: ApiService = inject(ApiService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private scrollKey: string = '';

  formGroup!: FormGroup;

  get(controlName: string): FormControl {
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    // Récupérer le paramètre de requête 'from' pour savoir d'où on vient
    const from = this.route.snapshot.queryParams['from'];
    if (from === 'terminees') {
      this.returnPage = 'terminees';
    } else {
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

    this.formGroup = new FormGroup({
      nom_commande: new FormControl(cmd.produit || '', [Validators.required]),
      deadline: new FormControl(cmd.deadline ? cmd.deadline.split('T')[0] : ''),
      description: new FormControl(cmd.description || ''),
      dimensions: new FormControl(cmd.gravure?.dimensions || ''),
      couleur: new FormControl(Array.isArray(cmd.personnalisation?.couleur) ? cmd.personnalisation.couleur.join(', ') : ''),
      support: new FormControl(cmd.support?.nom_support || ''),
      police_ecriture: new FormControl(cmd.personnalisation?.police || ''),
      texte_personnalisation: new FormControl(cmd.personnalisation?.texte || ''),
      quantité: new FormControl(cmd.quantité || 1),
      payé: new FormControl(cmd.payé || false),
      commentaire_paye: new FormControl(cmd.commentaire_paye || ''),
      prix_support: new FormControl(cmd.support?.prix_support || ''),
      url_support: new FormControl(cmd.support?.url_support || ''),
      prix_final: new FormControl(cmd.prix_final || ''),
      // Coordonnées contact
      nom: new FormControl(cmd.client.nom || ''),
      prenom: new FormControl(cmd.client.prénom || ''),
      telephone: new FormControl(cmd.client.téléphone || ''),
      mail: new FormControl(cmd.client.mail || '', [Validators.email]),
      // Adresse décomposée
      rue: new FormControl(this.extractAdressePart(cmd.client.adresse, 0) || ''),
      code_postal: new FormControl(this.extractAdressePart(cmd.client.adresse, 1) || ''),
      ville: new FormControl(this.extractAdressePart(cmd.client.adresse, 2) || ''),
      pays: new FormControl(this.extractAdressePart(cmd.client.adresse, 3) || 'Belgique'),
      tva: new FormControl(cmd.client.tva || ''),
    });
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

  toggleEditMode(): void {
    this.isEditMode.set(!this.isEditMode());
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
      prix_final: formValue.prix_final ? parseFloat(formValue.prix_final) : null,
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
      personnalisation: {
        texte: formValue.texte_personnalisation,
        police: formValue.police_ecriture,
        couleur: formValue.couleur ? (typeof formValue.couleur === 'string' ? formValue.couleur.split(',').map((c: string) => c.trim()).filter((c: string) => c) : formValue.couleur) : [],
      },
      gravure: {
        dimensions: formValue.dimensions,
      },
    };

    const id = this.commande()!.id_commande;
    this.apiService.put(`${ApiURI.UPDATE_COMMANDE}/${id}`, payload).subscribe({
      next: () => {
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
}
