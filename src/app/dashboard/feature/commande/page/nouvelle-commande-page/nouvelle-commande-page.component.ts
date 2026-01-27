import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent, FloatingLabelInputComponent, handleFormError, getFormValidationErrors, FormError } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';
import { NouvelleCommandeForm, CoordonneesContactForm } from '../../data/form/nouvelle-commande.form';
import { Couleur } from '../../model/commande.interface';
import { AppRoutes } from '@shared';

@Component({
  selector: 'app-nouvelle-commande-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent],
  templateUrl: './nouvelle-commande-page.component.html',
  styleUrl: './nouvelle-commande-page.component.scss'
})
export class NouvelleCommandePageComponent implements OnInit {
  formGroup!: FormGroup<NouvelleCommandeForm>;
  errors: WritableSignal<FormError[]> = signal([]);
  showSuccessPopup: WritableSignal<boolean> = signal(false);
  uploadedFiles: File[] = [];
  supportInputFocus: boolean = false;
  isDragOver: boolean = false;
  
  private readonly apiService: ApiService = inject(ApiService);
  
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

  constructor(private router: Router) {
    this.initFormGroup();
    handleFormError(this.formGroup, this.errors);
  }

  ngOnInit(): void {
    // Initialiser le pays par défaut
    this.formGroup.get('coordonnees_contact.pays')?.setValue('Belgique');
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  get coordonneesContact(): FormGroup<CoordonneesContactForm> {
    return this.formGroup.get('coordonnees_contact') as FormGroup<CoordonneesContactForm>;
  }

  getCoordonneeControl(key: string): FormControl<any> {
    const control = this.coordonneesContact.get(key);
    return control as FormControl<any>;
  }

  private initFormGroup(): void {
    this.formGroup = new FormGroup<NouvelleCommandeForm>(<NouvelleCommandeForm>{
      nom_commande: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(100)]),
      deadline: new FormControl<string>('', []),
      coordonnees_contact: new FormGroup<CoordonneesContactForm>(<CoordonneesContactForm>{
        nom: new FormControl<string>('', [Validators.maxLength(50)]),
        prenom: new FormControl<string>('', [Validators.maxLength(50)]),
        telephone: new FormControl<string>('', [Validators.maxLength(15)]),
        mail: new FormControl<string>('', [Validators.email]),
        rue: new FormControl<string>('', [Validators.maxLength(100)]),
        code_postal: new FormControl<string>('', [Validators.maxLength(10)]),
        ville: new FormControl<string>('', [Validators.maxLength(50)]),
        pays: new FormControl<string>('Belgique', [Validators.maxLength(50)]),
        tva: new FormControl<string>('', [Validators.maxLength(20)])
      }),
      description_projet: new FormControl<string>(''),
      dimensions_souhaitees: new FormControl<string>(''),
      couleur: new FormControl<string[]>([], []),
      support: new FormControl<string>('', []),
      police_ecriture: new FormControl<string>(''),
      texte_personnalisation: new FormControl<string>(''),
      fichiers_joints: new FormControl<File[]>([], []),
      quantité: new FormControl<number>(1, [Validators.min(1)])
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.uploadedFiles = [...this.uploadedFiles, ...files];
      this.formGroup.get('fichiers_joints')?.setValue(this.uploadedFiles);
    }
  }

  removeFile(index: number): void {
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
    const mail = this.formGroup.get('coordonnees_contact.mail')?.value?.trim();
    const mailValid = this.formGroup.get('coordonnees_contact.mail')?.valid;
    
    // Seul le nom de la commande est obligatoire
    // Si un email est fourni, il doit être valide
    if (mail && !mailValid) {
      return false;
    }
    
    return !!nomCommande;
  }

  onSubmit(): void {
    if (this.isFormValid()) {
      const formValue = this.formGroup.value;
      
      // Préparer le payload
      const coordonneesContact: any = {};
      if (formValue.coordonnees_contact?.nom?.trim()) {
        coordonneesContact.nom = formValue.coordonnees_contact.nom.trim();
      }
      if (formValue.coordonnees_contact?.prenom?.trim()) {
        coordonneesContact.prenom = formValue.coordonnees_contact.prenom.trim();
      }
      if (formValue.coordonnees_contact?.telephone?.trim()) {
        coordonneesContact.telephone = formValue.coordonnees_contact.telephone.trim();
      }
      if (formValue.coordonnees_contact?.mail?.trim()) {
        coordonneesContact.mail = formValue.coordonnees_contact.mail.trim();
      }
      if (formValue.coordonnees_contact?.rue?.trim()) {
        coordonneesContact.rue = formValue.coordonnees_contact.rue.trim();
      }
      if (formValue.coordonnees_contact?.code_postal?.trim()) {
        coordonneesContact.code_postal = formValue.coordonnees_contact.code_postal.trim();
      }
      if (formValue.coordonnees_contact?.ville?.trim()) {
        coordonneesContact.ville = formValue.coordonnees_contact.ville.trim();
      }
      if (formValue.coordonnees_contact?.pays?.trim()) {
        coordonneesContact.pays = formValue.coordonnees_contact.pays.trim();
      }
      if (formValue.coordonnees_contact?.tva?.trim()) {
        coordonneesContact.tva = formValue.coordonnees_contact.tva.trim();
      }

      // Construire l'adresse complète pour le backend
      const adresseParts: string[] = [];
      if (coordonneesContact.rue) adresseParts.push(coordonneesContact.rue);
      if (coordonneesContact.code_postal) adresseParts.push(coordonneesContact.code_postal);
      if (coordonneesContact.ville) adresseParts.push(coordonneesContact.ville);
      if (coordonneesContact.pays) adresseParts.push(coordonneesContact.pays);
      if (adresseParts.length > 0) {
        coordonneesContact.adresse = adresseParts.join(', ');
      }

      const payload: any = {
        nom_commande: formValue.nom_commande || '',
        ...(formValue.deadline && { deadline: formValue.deadline }),
        ...(Object.keys(coordonneesContact).length > 0 && { coordonnees_contact: coordonneesContact }),
        description_projet: formValue.description_projet,
        dimensions_souhaitees: formValue.dimensions_souhaitees,
        couleur: formValue.couleur || [],
        support: (formValue.support?.trim() || this.supportParDefaut),
        police_ecriture: formValue.police_ecriture,
        texte_personnalisation: formValue.texte_personnalisation,
        quantité: formValue.quantité || 1,
        fichiers_joints: [] // Pour l'instant, on envoie un tableau vide. L'upload de fichiers sera géré séparément
      };

      // Appel à l'API
      this.apiService.post(ApiURI.AJOUTER_COMMANDE, payload).subscribe({
        next: (response) => {
          if (response.result) {
            this.showSuccessPopup.set(true);
          } else {
            this.errors.set([{
              control: 'commande',
              value: '',
              error: 'Erreur lors de la création de la commande. Veuillez réessayer.'
            }]);
          }
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
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }

  onCancel(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED]);
  }

  onCreateNewCommande(): void {
    this.showSuccessPopup.set(false);
    this.formGroup.reset();
    
    // Réinitialiser les valeurs par défaut
    this.formGroup.get('coordonnees_contact.pays')?.setValue('Belgique');
    
    this.uploadedFiles = [];
    this.errors.set([]);
    // Scroll vers le haut de la page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onViewCommandes(): void {
    this.showSuccessPopup.set(false);
    this.router.navigate([AppRoutes.COMMANDES_EN_COURS]);
  }

  onSupportFocus(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.supportInputFocus = true;
    // Si le champ contient la valeur par défaut, sélectionner tout le texte
    if (input.value === this.supportParDefaut) {
      setTimeout(() => {
        input.select();
      }, 0);
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
