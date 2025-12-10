import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-floating-label-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './floating-label-input.component.html',
  styleUrl: './floating-label-input.component.scss'
})
export class FloatingLabelInputComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) control!: FormControl<any>;
  @Input({ required: true }) formGroup!: FormGroup;
  @Input() type: string = 'text';
  inputFocus: boolean = false;
}
