import { Component, DestroyRef, ElementRef, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { ClientApiService } from '../../service/client-api.service';
import { FicheClient, euros, initialesClient, nomClient } from '../../model/client.interface';

/**
 * Sélecteur de fiche client : recherche dans les fiches existantes.
 * - (choisi) : une fiche existante est sélectionnée
 * - (nouveau) : l'utilisateur part sur un nouveau client (formulaire vide)
 */
@Component({
  selector: 'gv-client-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-picker.component.html',
  styleUrl: './client-picker.component.scss',
})
export class ClientPickerComponent {
  private readonly clientApi = inject(ClientApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly query$ = new Subject<string>();

  /** Fiche actuellement liée (null = nouveau client). */
  @Input() selected: FicheClient | null = null;
  /** Masque l'option « Nouveau client » (rattachement à une fiche existante uniquement). */
  @Input() sansNouveau = false;
  @Input() placeholder = 'Client existant ? Nom, société, mail, téléphone…';
  /** Fiches à ne pas proposer (ex. celles du groupe en cours de fusion). */
  @Input() exclure: string[] = [];
  @Output() choisi = new EventEmitter<FicheClient>();
  @Output() nouveau = new EventEmitter<string>();
  @Output() retire = new EventEmitter<void>();

  readonly query = signal('');
  readonly results = signal<FicheClient[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly activeIndex = signal(0);

  readonly nomClient = nomClient;
  readonly initialesClient = initialesClient;
  readonly euros = euros;

  constructor() {
    this.query$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        tap(() => this.loading.set(true)),
        switchMap((q) => (q.trim().length < 2 ? of([]) : this.clientApi.recherche(q.trim(), 8).pipe(catchError(() => of([]))))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => {
        this.results.set(list.filter((c) => !this.exclure.includes(c.id_client)));
        this.activeIndex.set(0);
        this.loading.set(false);
      });
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.open.set(true);
    this.query$.next(value);
  }

  onKeydown(event: KeyboardEvent): void {
    const total = this.results().length + (this.sansNouveau ? 0 : 1); // + « Nouveau client »
    if (total === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.activeIndex.update((i) => (i + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => (i - 1 + total) % total);
    } else if (event.key === 'Enter') {
      if (!this.open()) return;
      event.preventDefault();
      const idx = this.activeIndex();
      const list = this.results();
      if (idx < list.length) this.choisir(list[idx]);
      else if (!this.sansNouveau) this.creer();
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  choisir(client: FicheClient): void {
    this.open.set(false);
    this.query.set('');
    this.results.set([]);
    this.choisi.emit(client);
  }

  creer(): void {
    this.open.set(false);
    this.nouveau.emit(this.query().trim());
  }

  retirer(): void {
    this.retire.emit();
  }

  contact(client: FicheClient): string {
    return [client.société && nomClient(client) !== client.société ? client.société : null, client.mail, client.téléphone]
      .filter(Boolean)
      .join(' · ');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
