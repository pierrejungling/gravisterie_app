import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-input',
  imports: [],
  templateUrl: './input.component.html',
  standalone: true,
  styleUrl: './input.component.scss'
})
export class InputComponent {
  @Input({required: true}) title!: string;
  @Output() titleChange = new EventEmitter<string>();
  @Input({required:false}) icon?:string;
  @Input({required:false}) placeholder:string ='Placeholder par défaut'
  @Output() coucou= new EventEmitter<string>();

  onClick():void{
    alert('Coucou petite perruche');
  }

}
