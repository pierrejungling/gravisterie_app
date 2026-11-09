import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Autorise le contenu SVG des icônes du menu (chaînes internes, jamais saisies par l'utilisateur). */
@Pipe({ name: 'gvSafeSvg', standalone: true })
export class SafeSvgPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
