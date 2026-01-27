import { Component, signal, WritableSignal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FloatingLabelInputComponent, HeaderComponent } from '@shared';
import { SignInForm } from '../../data/form';
import { handleFormError, getFormValidationErrors, FormError } from '@shared';
import { AppRoutes } from '@shared';
import { ApiService, TokenService } from '@api';
import { ApiURI } from '@api';

@Component({
  selector: 'app-sign-in-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FloatingLabelInputComponent, TranslateModule, HeaderComponent],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.scss'
})
export class SignInPageComponent {
  title: string = 'Welcome back !';
  subTitle: string = 'Identifiez-vous pour accéder à l\'administration de La Gravisterie';
  successMessage: string = '';
  logoPath: string = 'assets/images/Logo/La Gravisterie_N.svg';
  logoError: boolean = false;

  formGroup!: FormGroup<SignInForm>;
  errors: WritableSignal<FormError[]> = signal([]);
  private readonly apiService: ApiService = inject(ApiService);
  private readonly tokenService: TokenService = inject(TokenService);

  constructor(private router: Router) {
    this.initFormGroup();
    // !!!!!! YOU NEED TO CALL THIS IN CONSTRUCTOR COMPONENT !!!!!!!!! BECAUSE OF TAKEUNTILDESTROYED
    handleFormError(this.formGroup, this.errors);
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  private initFormGroup(): void {
    this.formGroup = new FormGroup<SignInForm>(<SignInForm>{
      username: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]),
      password: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(20)])
    });
    // Subscribe to valueChanges to log form values (for testing)
    this.formGroup.valueChanges.subscribe(() => 
      console.log('formGroupValue', this.formGroup.value)
    );
  }

  signIn(): void {
    if (this.formGroup.valid) {
      const formValue = this.formGroup.value;
      const username = formValue.username || '';
      const password = formValue.password || '';
      
      // Appel à l'API NestJS
      this.apiService.post(ApiURI.SIGN_IN, {
        username: username,
        password: password,
        socialLogin: false,
        googleHash: '',
        facebookHash: ''
      }).subscribe({
        next: (response) => {
          if (response.result && response.data) {
            // Stocker le token via le TokenService
            this.tokenService.setToken({
              token: response.data.token,
              refreshToken: response.data.refreshToken,
              isEmpty: false
            });
            
            // Stocker le nom d'utilisateur dans localStorage pour l'affichage
            localStorage.setItem('currentUser', username);
            
            this.successMessage = 'Connexion réussie ! Redirection...';
            console.log('Connexion réussie pour:', username);
            
            // Rediriger vers le dashboard après un court délai
            setTimeout(() => {
              this.router.navigate([AppRoutes.AUTHENTICATED]);
            }, 1000);
          } else {
            this.errors.set([{
              control: 'credentials',
              value: '',
              error: 'Nom d\'utilisateur ou mot de passe incorrect'
            }]);
          }
        },
        error: (error) => {
          console.error('Erreur lors de la connexion:', error);
          this.errors.set([{
            control: 'credentials',
            value: '',
            error: 'Erreur lors de la connexion. Veuillez réessayer.'
          }]);
        }
      });
    } else {
      // Trigger validation errors display
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }


  onLogoLoad(): void {
    this.logoError = false;
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
    }
    this.logoError = true;
  }
}
