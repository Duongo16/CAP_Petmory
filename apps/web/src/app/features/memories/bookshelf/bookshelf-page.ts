import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Pet } from '../../../core/models/api.model';
import { PetsService } from '../../../core/services/pets.service';
import { MemoriesService } from '../../../core/services/memories.service';
import { Icon } from '../../../shared/icon/icon';
import { PetArt } from '../../../shared/pet-art/pet-art';
import { PetFace } from '../../../shared/pet-face/pet-face';

type ScreenState = 'LOADING' | 'ERROR' | 'EMPTY' | 'DONE';

/** The cover colours the books take in turn along the shelf. */
const TONES = ['clay', 'olive', 'cocoa', 'honey'] as const;
type Tone = (typeof TONES)[number];

/** Width of the book once it has flown to the middle of the screen. */
const OPEN_WIDTH = 300;

interface Book {
  id: string;
  name: string;
  tagline: string;
  pages: number;
  tone: Tone;
  kind: string;
  avatarUrl: string;
}

/** A book on its way from the shelf to the middle of the screen. */
interface Flight {
  book: Book;
  dx: number;
  dy: number;
  scale: number;
}

/**
 * Every pet's diary as a book on a shelf. Picking one lifts it off, flies it
 * to the middle of the screen and opens its cover before the diary itself
 * appears. A link can name a pet, and that book is taken down on its own.
 */
@Component({
  selector: 'pm-bookshelf-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe, Icon, PetArt, PetFace],
  templateUrl: './bookshelf-page.html',
  styleUrl: './bookshelf-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookshelfPage implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly memories = inject(MemoriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bookButtons = viewChildren<ElementRef<HTMLElement>>('bookButton');

  readonly status = signal<ScreenState>('LOADING');
  readonly books = signal<Book[]>([]);
  readonly flight = signal<Flight | null>(null);

  /** Whether the list of pets to write for is open under the write button. */
  readonly choosing = signal(false);

  ngOnInit(): void {
    this.pets
      .list()
      .pipe(
        switchMap((rows) =>
          rows.length === 0
            ? of([] as Book[])
            : forkJoin(rows.map((pet, at) => this.bookOf(pet, at))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (books) => {
          this.books.set(books);
          this.status.set(books.length === 0 ? 'EMPTY' : 'DONE');
          const wanted = this.route.snapshot.queryParamMap.get('open');
          if (wanted) {
            afterNextRender(() => this.takeDown(wanted), { injector: this.injector });
          }
        },
        error: () => this.status.set('ERROR'),
      });
  }

  /** With one pet there is nothing to choose; with several, the list opens. */
  write(): void {
    const all = this.books();
    if (all.length === 1) {
      void this.router.navigate(['/pets', all[0].id, 'journal'], { queryParams: { write: 1 } });
      return;
    }
    this.choosing.update((open) => !open);
  }

  /** Takes a book off the shelf from where it was clicked. */
  pick(book: Book, event: Event): void {
    this.fly(book, (event.currentTarget as HTMLElement).getBoundingClientRect());
  }

  /** Called when the cover has finished opening: the diary itself takes over. */
  arrived(event: AnimationEvent): void {
    const book = this.flight()?.book;
    if (book && event.animationName.includes('bs-open')) {
      void this.router.navigate(['/pets', book.id, 'journal']);
    }
  }

  private takeDown(petId: string): void {
    const book = this.books().find((one) => one.id === petId);
    const button = this.bookButtons().find((one) => one.nativeElement.dataset['pet'] === petId);
    if (book && button) {
      button.nativeElement.scrollIntoView({ block: 'center' });
      this.fly(book, button.nativeElement.getBoundingClientRect());
    }
  }

  private fly(book: Book, from: DOMRect): void {
    if (this.flight()) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void this.router.navigate(['/pets', book.id, 'journal']);
      return;
    }
    this.flight.set({
      book,
      dx: from.left + from.width / 2 - window.innerWidth / 2,
      dy: from.top + from.height / 2 - window.innerHeight / 2,
      scale: from.width / OPEN_WIDTH,
    });
  }

  private bookOf(pet: Pet, at: number) {
    const pages = this.memories.forPet(pet._id).pipe(
      map((page) => page.total),
      catchError(() => of(0)),
    );
    return forkJoin({ pages }).pipe(
      map(
        (got): Book => ({
          id: pet._id,
          name: pet.name,
          tagline: pet.tagline,
          pages: got.pages,
          tone: TONES[at % TONES.length],
          kind: pet.kind,
          avatarUrl: pet.avatarUrl,
        }),
      ),
    );
  }

}
