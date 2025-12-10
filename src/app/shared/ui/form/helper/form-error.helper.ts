import { FormGroup, ValidationErrors } from '@angular/forms';
import { FormError, GetAllFormErrorsFn, HandleValueChangeFn } from '../type';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WritableSignal } from '@angular/core';
import { map, tap } from 'rxjs';

// !!!!!! YOU NEED TO CALL THIS IN CONSTRUCTOR COMPONENT !!!!!!!!! BECAUSE OF TAKEUNTILDESTROYED
// https://indepth.dev/posts/1518/takeuntildestroy-in-angular-v16
export const handleFormError: HandleValueChangeFn = (
  form: FormGroup,
  signal: WritableSignal<FormError[]>
): void => {
  form.valueChanges
    .pipe(
      // that's mean kill this observer when component is destroyed
      takeUntilDestroyed(),
      // transform the value to FormError array
      map(() => getFormValidationErrors(form)),
      // send signal with new errors
      tap((errors: FormError[]) => signal.set(errors))
    )
    .subscribe();
};

// Cette méthode va simplement extraire les erreurs des différents controls.
// https://gist.github.com/thisisJohannes/7be53b03d37f7e8f7f1a
export const getFormValidationErrors: GetAllFormErrorsFn = (form: FormGroup): FormError[] => {
  const result: FormError[] = [];
  Object.keys(form.controls).forEach(key => {
    const controlErrors: ValidationErrors | null = form.get(key)!.errors;
    if (controlErrors) {
      Object.keys(controlErrors).forEach(keyError => {
        result.push({
          control: key,
          error: keyError,
          value: controlErrors[keyError]
        });
      });
    }
  });
  return result;
};
