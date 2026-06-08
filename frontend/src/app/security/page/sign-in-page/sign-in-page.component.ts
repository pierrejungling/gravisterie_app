import { Component, signal, WritableSignal, inject, computed, effect } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { FloatingLabelInputComponent, HeaderComponent, ThemeService } from '@shared';
import { SignInForm } from '../../data/form';
import { getFormValidationErrors, FormError } from '@shared';
import { AppRoutes } from '@shared';
import { ApiService, AuthSessionService, TokenService } from '@api';
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
  logoError: boolean = false;

  formGroup!: FormGroup<SignInForm>;
  errors: WritableSignal<FormError[]> = signal([]);
  submitted = false;
  private readonly apiService: ApiService = inject(ApiService);
  private readonly tokenService: TokenService = inject(TokenService);
  private readonly authSession: AuthSessionService = inject(AuthSessionService);
  private readonly themeService: ThemeService = inject(ThemeService);

  // Liste des fichiers logo possibles à essayer (ordre de priorité)
  private readonly possibleLogosLight = [
    // Logo principal spécifié par l'utilisateur (mode clair)
    'assets/images/Logo/La Gravisterie_N.svg',
    // Fallback vers autres formats
    'assets/images/Logo/La Gravisterie avec noir txt_N.svg',
    'assets/images/Logo/La Gravisterie carré_N.svg',
    'assets/images/Logo/logo_carre.png'
  ];

  private readonly possibleLogosDark = [
    // Logo blanc pour mode nuit
    'assets/images/Logo/La Gravisterie Blanc.svg',
    // Fallback vers autres formats blancs
    'assets/images/Logo/La Gravisterie blanc sans fond copie.svg',
    'assets/images/Logo/La Gravisterie blanc carré.svg',
    'assets/images/Logo/La Gravisterie avec txt blanc sans fond copie.svg'
  ];

  // Signal pour le logo de fallback (en cas d'erreur)
  private fallbackLogoPath = signal<string>('');

  // Computed signal pour le logo selon le thème
  logoPath = computed(() => {
    // Si un fallback a été défini, l'utiliser
    const fallback = this.fallbackLogoPath();
    if (fallback) {
      return fallback;
    }
    
    // Sinon, utiliser le logo selon le thème
    const isDark = this.themeService.isDarkMode();
    const possibleLogos = isDark ? this.possibleLogosDark : this.possibleLogosLight;
    return possibleLogos[0];
  });

  constructor(private router: Router) {
    this.initFormGroup();

    // Réinitialiser le fallback quand le thème change
    effect(() => {
      this.themeService.theme(); // S'abonner aux changements de thème
      this.fallbackLogoPath.set(''); // Réinitialiser le fallback
    });
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  private validationMessage(key: string, value: any): string | null {
    if (key === 'required') return 'Ce champ est requis';
    if (key === 'minlength') return `Minimum ${value?.requiredLength ?? 0} caractères`;
    if (key === 'maxlength') return `Maximum ${value?.requiredLength ?? 0} caractères`;
    return null;
  }

  getFieldErrorMessage(controlName: string): string | null {
    const control = this.get(controlName);
    if (!control) return null;
    const serverError = this.errors().find((e) => e.control === controlName);
    if (serverError && !['required', 'minlength', 'maxlength'].includes(serverError.error)) return serverError.error;
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    const err = control.errors;
    if (!err) return null;
    const key = Object.keys(err)[0];
    return this.validationMessage(key, err[key]) ?? 'Champ invalide';
  }

  hasFieldError(controlName: string): boolean {
    return this.getFieldErrorMessage(controlName) != null;
  }

  getCredentialsError(): string | null {
    const err = this.errors().find((e) => e.control === 'credentials');
    return err ? err.error : null;
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
            
            // Rediriger vers la dernière page visitée ou le dashboard
            setTimeout(() => {
              const returnUrl = this.authSession.consumeReturnUrl();
              this.router.navigateByUrl(returnUrl ?? AppRoutes.AUTHENTICATED);
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
      this.submitted = true;
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }


  onLogoLoad(): void {
    this.logoError = false;
    // Réinitialiser le fallback quand le logo charge avec succès
    this.fallbackLogoPath.set('');
    console.log('Logo chargé avec succès:', this.logoPath());
  }

  onLogoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      console.error('Erreur de chargement du logo:', img.src);
      img.style.display = 'none';
    }
    
    // Essayer le logo suivant
    this.tryNextLogo();
  }

  private tryNextLogo(): void {
    const isDark = this.themeService.isDarkMode();
    const possibleLogos = isDark ? this.possibleLogosDark : this.possibleLogosLight;
    const currentPath = this.logoPath();
    
    // Trouver l'index du logo actuel dans la liste appropriée
    const currentIndex = possibleLogos.indexOf(currentPath);
    
    console.error('Erreur de chargement du logo:', currentPath, 'Index:', currentIndex);
    
    // Essayer le logo suivant
    if (currentIndex < possibleLogos.length - 1 && currentIndex >= 0) {
      // Essayer sans encodage d'abord
      const nextLogo = possibleLogos[currentIndex + 1];
      this.fallbackLogoPath.set(nextLogo);
      this.logoError = false;
      console.log('Essai du logo suivant (sans encodage):', nextLogo);
    } else if (currentIndex === -1 && !currentPath.includes('%20')) {
      // Le logo actuel n'est pas dans la liste, essayer avec encodage
      console.log('Tentative avec encodage des espaces...');
      const encodedLogo = possibleLogos[0].split('/').map(part => encodeURIComponent(part)).join('/');
      this.fallbackLogoPath.set(encodedLogo);
      this.logoError = false;
    } else {
      // Tous les logos ont échoué
      this.logoError = true;
      console.error('Tous les logos ont échoué à charger');
    }
  }
}
