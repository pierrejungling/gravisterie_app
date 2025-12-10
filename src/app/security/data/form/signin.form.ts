import { FormControl } from '@angular/forms';

export interface SignInForm {
  username: FormControl<string>;
  password: FormControl<string>;
}
