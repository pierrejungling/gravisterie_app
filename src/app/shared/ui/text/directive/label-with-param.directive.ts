import { Directive, Input, OnInit, inject, ElementRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Directive({
  selector: '[labelWithParam]',
  standalone: true
})
export class LabelWithParamDirective implements OnInit {
  @Input({ required: true }) label!: string;
  @Input() params?: any;
  readonly translate: TranslateService = inject(TranslateService);
  el: ElementRef = inject(ElementRef);

  ngOnInit(): void {
    this.el.nativeElement.innerHTML = this.translate.instant(this.label, this.params);
  }
}
