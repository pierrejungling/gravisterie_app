import { Component, signal, WritableSignal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FloatingLabelInputComponent, HeaderComponent } from '@shared';
import { SignUpForm } from '../../data/form';
import { handleFormError, getFormValidationErrors, FormError } from '@shared';
import { AppRoutes } from '@shared';
import { ApiService } from '@api';
import { ApiURI } from '@api';

// Validateur personnalisé pour vérifier que les mots de passe correspondent
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (!password || !confirmPassword) {
    return null;
  }
  
  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-sign-up-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FloatingLabelInputComponent, TranslateModule, HeaderComponent],
  templateUrl: './sign-up-page.component.html',
  styleUrl: './sign-up-page.component.scss'
})
export class SignUpPageComponent {
  title: string = 'Créer un compte';
  subTitle: string = 'Rejoignez-nous et commencez votre aventure';
  successMessage: string = '';
  errors: WritableSignal<FormError[]> = signal([]);
  formGroup!: FormGroup<SignUpForm>;
  private readonly apiService: ApiService = inject(ApiService);

  constructor(private router: Router) {
    this.initFormGroup();
    handleFormError(this.formGroup, this.errors);
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  private initFormGroup(): void {
    this.formGroup = new FormGroup<SignUpForm>(<SignUpForm>{
      username: new FormControl<string>('', [
        Validators.required, 
        Validators.minLength(1), 
        Validators.maxLength(20)
      ]),
      email: new FormControl<string>('', [
        Validators.required,
        Validators.email
      ]),
      password: new FormControl<string>('', [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(20)
      ]),
      confirmPassword: new FormControl<string>('', [
        Validators.required
      ])
    }, { validators: passwordMatchValidator });

    this.formGroup.valueChanges.subscribe(() => 
      console.log('signUpFormGroupValue', this.formGroup.value)
    );
  }

  signUp(): void {
    if (this.formGroup.valid) {
      const formValue = this.formGroup.value;
      
      // Appel à l'API NestJS pour l'inscription
      this.apiService.post(ApiURI.SIGN_UP, {
        username: formValue.username || '',
        password: formValue.password || '',
        mail: formValue.email || '',
        googleHash: '',
        facebookHash: ''
      }).subscribe({
        next: (response) => {
          console.log('Réponse API signup:', response);
          if (response.result) {
      this.successMessage = 'Inscription réussie ! Redirection vers la page de connexion...';
      
      // Rediriger vers la page de connexion après 2 secondes
      setTimeout(() => {
        this.router.navigate([AppRoutes.SIGN_IN]);
      }, 2000);
          } else {
            // Gérer les erreurs de validation du backend
            let errorMessages: FormError[] = [];
            console.log('Erreur signup - response.data:', response.data);
            console.log('Erreur signup - response.code:', response.code);
            
            // Les erreurs de validation sont dans response.data
            if (response.data && Array.isArray(response.data)) {
              response.data.forEach((errorCode: any) => {
                const codeStr = String(errorCode);
                console.log('Code d\'erreur:', codeStr);
                if (codeStr.includes('USERNAME_IS_NOT_EMPTY') || codeStr.includes('USERNAME_LENGTH')) {
                  errorMessages.push({
                    control: 'username',
                    value: '',
                    error: 'Le nom d\'utilisateur doit contenir entre 1 et 20 caractères.'
                  });
                } else if (codeStr.includes('PASSWORD_IS_NOT_EMPTY') || codeStr.includes('PASSWORD_LENGTH')) {
                  errorMessages.push({
                    control: 'password',
                    value: '',
                    error: 'Le mot de passe doit contenir entre 1 et 20 caractères.'
                  });
                } else if (codeStr.includes('MAIL_IS_NOT_EMPTY') || codeStr.includes('MAIL_IS_EMAIL')) {
                  errorMessages.push({
                    control: 'email',
                    value: '',
                    error: 'L\'adresse email n\'est pas valide.'
                  });
                } else {
                  // Afficher le code d'erreur si on ne le reconnaît pas
                  errorMessages.push({
                    control: 'signup',
                    value: '',
                    error: `Erreur de validation: ${codeStr}`
                  });
                }
              });
            }
            
            // Si pas d'erreurs spécifiques, message générique
            if (errorMessages.length === 0) {
              const codeStr = String(response.code || '');
              if (codeStr.includes('USER_ALREADY_EXIST')) {
                errorMessages.push({
                  control: 'username',
                  value: '',
                  error: 'Ce nom d\'utilisateur ou cet email existe déjà.'
                });
              } else if (codeStr.includes('signup_error')) {
                errorMessages.push({
                  control: 'signup',
                  value: '',
                  error: 'Erreur lors de l\'inscription. Veuillez vérifier que la base de données est accessible et que tous les champs sont valides.'
                });
              } else {
                errorMessages.push({
                  control: 'signup',
                  value: '',
                  error: `Erreur lors de l'inscription. Code: ${codeStr || 'INCONNU'}`
                });
              }
            }
            
            this.errors.set(errorMessages);
          }
        }
      });
    } else {
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }

  goToSignIn(): void {
    this.router.navigate([AppRoutes.SIGN_IN]);
  }
}
