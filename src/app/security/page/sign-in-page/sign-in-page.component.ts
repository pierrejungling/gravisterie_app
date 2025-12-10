import { Component, signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FloatingLabelInputComponent } from '@shared';
import { SignInForm } from '../../data/form';
import { handleFormError, getFormValidationErrors, FormError } from '@shared';

@Component({
  selector: 'app-sign-in-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FloatingLabelInputComponent, TranslateModule],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './sign-in-page.component.scss'
})
export class SignInPageComponent {
  title: string = 'Welcome back!';
  subTitle: string = 'Identifiez-vous pour accéder à l\'administration';

  formGroup!: FormGroup<SignInForm>;
  errors: WritableSignal<FormError[]> = signal([]);

  constructor() {
    this.initFormGroup();
    // !!!!!! YOU NEED TO CALL THIS IN CONSTRUCTOR COMPONENT !!!!!!!!! BECAUSE OF TAKEUNTILDESTROYED
    handleFormError(this.formGroup, this.errors);
  }

  get(key: string): FormControl<any> {
    return this.formGroup.get(key) as FormControl<any>;
  }

  private initFormGroup(): void {
    this.formGroup = new FormGroup<SignInForm>(<SignInForm>{
      username: new FormControl<string>('', [Validators.required, Validators.minLength(1), Validators.maxLength(10)]),
      password: new FormControl<string>('', [Validators.required])
    });
    // Subscribe to valueChanges to log form values (for testing)
    this.formGroup.valueChanges.subscribe(() => 
      console.log('formGroupValue', this.formGroup.value)
    );
  }

  signIn(): void {
    if (this.formGroup.valid) {
      // TODO: Implement sign in logic
      console.log('Form is valid, submitting:', this.formGroup.value);
    } else {
      // Trigger validation errors display
      this.formGroup.markAllAsTouched();
      this.errors.set(getFormValidationErrors(this.formGroup));
    }
  }
}
