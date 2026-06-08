import { Component, OnInit, signal, WritableSignal, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '@shared';
import { FloatingLabelInputComponent } from '@shared';
import { getFormValidationErrors, FormError } from '@shared';
import { AppRoutes } from '@shared';
import { AuthSessionService, TokenService } from '@api';

interface CredentialsForm {
  username: FormControl<string>;
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HeaderComponent, FloatingLabelInputComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit {
  formGroup!: FormGroup<CredentialsForm>;
  errors: WritableSignal<FormError[]> = signal([]);
  submitted = false;
  successMessage: string = '';
  currentUsername: string = '';

  private readonly tokenService = inject(TokenService);
  private readonly authSession = inject(AuthSessionService);

  constructor(private router: Router) {
    this.initFormGroup();
  }

  logout(): void {
    this.authSession.clearPersistedRoutes();
    this.tokenService.setToken({ token: '', refreshToken: '', isEmpty: true });
    localStorage.removeItem('currentUser');
    this.router.navigate([AppRoutes.SIGN_IN]);
  }

  ngOnInit(): void {
    // Récupérer les identifiants actuels
    const storedData = localStorage.getItem('userCredentials');
    if (storedData) {
      try {
        const userData = JSON.parse(storedData);
        this.currentUsername = atob(userData.username);
        this.formGroup.patchValue({
          username: this.currentUsername
        });
      } catch (error) {
        console.error('Erreur lors de la récupération des identifiants:', error);
      }
    }
  }

  private initFormGroup(): void {
    this.formGroup = new FormGroup<CredentialsForm>(<CredentialsForm>{
      username: new FormControl<string>('', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20)
      ]),
      currentPassword: new FormControl<string>('', [
        Validators.required
      ]),
      newPassword: new FormControl<string>('', [
        Validators.required,
        Validators.minLength(6)
      ]),
      confirmPassword: new FormControl<string>('', [
        Validators.required
      ])
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator = (control: any): { [key: string]: boolean } | null => {
    const newPassword = control.get('newPassword');
    const confirmPassword = control.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    return newPassword.value === confirmPassword.value ? null : { passwordMismatch: true };
  };

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  private readonly validationKeys = ['required', 'minlength', 'maxlength', 'passwordMismatch'];

  getFieldErrorMessage(controlName: string): string | null {
    const control = this.get(controlName);
    if (!control) return null;
    const serverError = this.errors().find((e) => e.control === controlName);
    if (serverError && !this.validationKeys.includes(serverError.error)) {
      return serverError.error;
    }
    if (!control.invalid || (!control.touched && !this.submitted)) return null;
    const err = control.errors;
    if (!err) return null;
    const key = Object.keys(err)[0];
    return this.validationMessage(key, err[key]) ?? 'Champ invalide';
  }

  private validationMessage(key: string, value: any): string | null {
    if (key === 'required') return 'Ce champ est requis';
    if (key === 'minlength') return `Minimum ${value?.requiredLength ?? 0} caractères`;
    if (key === 'maxlength') return `Maximum ${value?.requiredLength ?? 0} caractères`;
    if (key === 'passwordMismatch') return 'Les mots de passe ne correspondent pas';
    return null;
  }

  hasFieldError(controlName: string): boolean {
    return this.getFieldErrorMessage(controlName) != null;
  }

  getGeneralError(): string | null {
    const err = this.errors().find((e) => e.control === 'general');
    return err ? err.error : null;
  }

  updateCredentials(): void {
    if (this.formGroup.valid) {
      const formValue = this.formGroup.value;
      const storedData = localStorage.getItem('userCredentials');
      
      if (storedData) {
        try {
          const userData = JSON.parse(storedData);
          const currentPassword = atob(userData.password);
          
          // Vérifier que le mot de passe actuel est correct
          if (formValue.currentPassword !== currentPassword) {
            this.errors.set([{
              control: 'currentPassword',
              value: '',
              error: 'Le mot de passe actuel est incorrect'
            }]);
            return;
          }
          
          // Encoder les nouveaux identifiants
          const encodedUsername = btoa(formValue.username || '');
          const encodedPassword = btoa(formValue.newPassword || '');
          
          // Mettre à jour les identifiants
          const updatedUserData = {
            username: encodedUsername,
            password: encodedPassword,
            email: userData.email || '',
            originalUsername: formValue.username
          };
          
          localStorage.setItem('userCredentials', JSON.stringify(updatedUserData));
          
          // Mettre à jour le nom d'utilisateur actuel si nécessaire
          if (formValue.username !== this.currentUsername) {
            localStorage.setItem('currentUser', formValue.username || '');
          }
          
          this.successMessage = 'Identifiants mis à jour avec succès !';
          
          // Réinitialiser le formulaire
          setTimeout(() => {
            this.formGroup.reset();
            this.formGroup.patchValue({
              username: formValue.username
            });
            this.successMessage = '';
          }, 3000);
          
        } catch (error) {
          console.error('Erreur lors de la mise à jour:', error);
          this.errors.set([{
            control: 'general',
            value: '',
            error: 'Erreur lors de la mise à jour des identifiants'
          }]);
        }
      }
    } else {
      this.submitted = true;
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }

  goToDashboard(): void {
    this.router.navigate([AppRoutes.AUTHENTICATED]);
  }
}
