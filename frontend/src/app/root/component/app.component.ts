import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { Language } from '@shared';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  standalone: true,
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'app';
  translate = inject(TranslateService);
  private router = inject(Router);

  /** Premier NavigationEnd = chargement initial (reload ou première visite) → ne pas scroller pour garder la restauration. Les suivants = navigation clic → scroller en haut. */
  private initialNavigation = true;
  private navEndSub = this.router.events
    .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
    .subscribe(() => {
      if (this.initialNavigation) {
        this.initialNavigation = false;
        return;
      }
      this.scrollToTop();
    });

  ngOnInit(): void {
    this.translate.setDefaultLang(Language.FR);
    this.translate.use(Language.FR);
  }

  ngOnDestroy(): void {
    this.navEndSub?.unsubscribe();
  }

  /** Scroll en haut de la page (desktop, mobile, iPad) après mise à jour de la vue. */
  private scrollToTop(): void {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }
}
