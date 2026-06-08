import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { AuthSessionService } from '@api';
import { Language, ThemeService } from '@shared';

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
  private authSession = inject(AuthSessionService);
  private themeService = inject(ThemeService);

  /** Premier NavigationEnd = chargement initial (reload ou première visite) → ne pas scroller pour garder la restauration. Les suivants = navigation clic → scroller en haut. */
  private initialNavigation = true;
  private navEndSub = this.router.events
    .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
    .subscribe((event) => {
      this.authSession.persistCurrentRoute(event.urlAfterRedirects);
      if (this.initialNavigation) {
        this.initialNavigation = false;
        return;
      }
      this.scrollToTop();
    });

  ngOnInit(): void {
    this.translate.setDefaultLang(Language.FR);
    this.translate.use(Language.FR);
    this.authSession.persistCurrentRoute(this.router.url);
    this.authSession.refreshAccessTokenIfNeeded().subscribe();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pagehide', this.onPageHide);
  }

  ngOnDestroy(): void {
    this.navEndSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pagehide', this.onPageHide);
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.authSession.onAppVisible();
      return;
    }
    this.authSession.persistCurrentRoute(this.router.url);
  };

  private onPageHide = (): void => {
    this.authSession.persistCurrentRoute(this.router.url);
  };

  /** Scroll en haut de la page (desktop, mobile, iPad) après mise à jour de la vue. */
  private scrollToTop(): void {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }
}
