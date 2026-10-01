import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MemoriesFacade } from './memories-facade';
import { PetFaceService } from '../../core/services/pet-face.service';
import { MomentDialog, MomentRequest, MomentResult } from './moment-dialog';
import { ShareDialog, ShareRequest } from './share-dialog';
import { ExportDialog, ExportRequest } from './export-dialog';
import { DiaryBookView } from './book/diary-book';
import { PageFace } from './book/page-face';
import { PageEditor, PageEditRequest, PageEditResult } from './book/page-editor';
import { PaperKind } from '../../shared/diary-art';
import { Memory, MemoryTopic } from '../../core/models/api.model';
import { Icon } from '../../shared/icon/icon';
import { PetPhotos } from './pet-photos/pet-photos';

/** Ba cach xem nhat ky cua mot be. */
type DiaryView = 'BOOK' | 'MAP' | 'PHOTOS';

const DIARY_TABS: { view: DiaryView; key: string }[] = [
  { view: 'BOOK', key: 'BOOK.AS_BOOK' },
  { view: 'MAP', key: 'BOOK.AS_LIST' },
  { view: 'PHOTOS', key: 'BOOK.AS_PHOTOS' },
];

/** Doc tab tu duong dan, chi nhan nhung tab co that. */
function viewFrom(raw: string | null): DiaryView {
  const wanted = (raw ?? '').toUpperCase();
  return DIARY_TABS.find((one) => one.view === wanted)?.view ?? 'BOOK';
}

@Component({
  selector: 'pm-memories-page',
  standalone: true,
  imports: [RouterLink, DatePipe, TranslatePipe, DiaryBookView, Icon, PetPhotos],
  providers: [MemoriesFacade],
  templateUrl: './memories-page.html',
  styleUrl: './memories-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemoriesPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly facade = inject(MemoriesFacade);
  private readonly petFaces = inject(PetFaceService);
  private readonly page = inject(DOCUMENT);

  /** Dang xem quyen so, ban do thoi gian hay danh sach anh cua be. */
  readonly view = signal<DiaryView>('BOOK');
  readonly asBook = computed(() => this.view() === 'BOOK');

  readonly tabs = DIARY_TABS;

  /** Ma cua be dang mo, doc mot lan tu duong dan. */
  petId = '';

  /**
   * Cac mat giay cua quyen so.
   *
   * Bia dung truoc, roi tung khoanh khac mot trang, va mot trang ket o cuoi.
   * Khoanh khac moi nhat nam gan bia, y nhu mot quyen so ma trang moi luon
   * duoc lat den truoc.
   */
  readonly faces = computed<PageFace[]>(() => {
    const pet = this.facade.pet();
    /*
     * Quyen so doc tu dau den cuoi, nen trang dau la khoanh khac cu nhat.
     * Dong thoi gian thi nguoc lai, moi nhat len truoc, nen o day phai dao
     * lai thu tu chu khong dung thang thu tu cua dong thoi gian.
     */
    const rows = this.facade
      .months()
      .flatMap((group) => group.cards.map((card) => card.raw))
      .slice()
      .reverse();
    const out: PageFace[] = [
      {
        kind: 'COVER',
        number: 0,
        moment: null,
        paper: 'KRAFT',
        petName: pet?.name ?? '',
        tagline: pet?.tagline ?? '',
        // No avatar of its own yet: the first album photo makes a better cover than a blank.
        avatarUrl: pet?.avatarUrl || this.petFaces.faces()[pet?._id ?? ''] || '',
        momentCount: this.facade.total(),
      },
    ];
    rows.forEach((one, at) => {
      out.push({
        kind: 'MOMENT',
        number: at + 1,
        moment: one,
        paper: (one.paper || 'CREAM') as PaperKind,
        petName: '',
        tagline: '',
        avatarUrl: '',
        momentCount: 0,
      });
    });
    out.push({
      kind: 'END',
      number: 0,
      moment: null,
      paper: 'KRAFT',
      petName: '',
      tagline: '',
      avatarUrl: '',
      momentCount: 0,
    });
    return out;
  });

  /** Doi tab va ghi lai vao duong dan, de tai lai trang van mo dung tab. */
  show(view: DiaryView): void {
    this.view.set(view);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: view === 'BOOK' ? null : view.toLowerCase() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Album vua doi thi cap nhat anh dai dien va kho anh cua hop viet. */
  photosChanged(): void {
    this.petFaces.refresh(this.petId);
    this.facade.loadAlbum();
  }

  /** Mo hop bay tri cho mot trang, roi luu lai nhung gi nguoi dung dat. */
  decorate(face: PageFace): void {
    if (!face.moment) {
      return;
    }
    this.dialog
      .open<PageEditor, PageEditRequest, PageEditResult>(PageEditor, {
        data: { moment: face.moment, shots: this.facade.shots() },
        width: 'min(880px, 96vw)',
        maxHeight: '94vh',
        panelClass: ['pm-dialog', 'pm-dialog-wide'],
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((done) => {
        if (done) {
          this.facade.keepPage(done.momentId, done.decor, done.paper);
        }
      });
  }

  /** Set when the bookcase sent the reader here to write a new page straight away. */
  private writeOnArrival = false;

  /** Opens the writer once the diary has loaded, then takes the request out of the address. */
  protected readonly writeWhenReady = effect(() => {
    if (this.writeOnArrival && this.facade.status() === 'DONE') {
      this.writeOnArrival = false;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { write: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
      this.openWriter();
    }
  });

  ngOnInit(): void {
    this.writeOnArrival = this.route.snapshot.queryParamMap.get('write') === '1';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.petId = id;
    this.view.set(viewFrom(this.route.snapshot.queryParamMap.get('view')));
    this.petFaces.request(id);
    this.facade.start(id);
  }

  /** Reads the chosen topic from the filter box, accepting only a topic the box offers. */
  chooseFrom(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const topic = this.facade.chips().find((one) => (one.topic ?? '') === value)?.topic ?? null;
    this.choose(topic);
  }

  choose(topic: MemoryTopic | null): void {
    this.facade.choose(topic);
  }

  openWriter(): void {
    this.dialog
      .open<MomentDialog, MomentRequest, MomentResult>(MomentDialog, {
        data: { petId: this.facade.currentPetId, shots: this.facade.shots() },
        width: 'min(880px, 96vw)',
        maxHeight: '92vh',
        panelClass: ['pm-dialog', 'pm-dialog-wide'],
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((written) => {
        if (written) {
          this.facade.write(written);
        }
      });
  }


  openShares(): void {
    this.dialog.open<ShareDialog, ShareRequest>(ShareDialog, {
      data: { facade: this.facade, origin: this.page.location.origin },
      width: 'min(560px, 94vw)',
      maxHeight: '92vh',
      panelClass: 'pm-dialog',
      autoFocus: 'first-tabbable',
    });
  }

  openExport(): void {
    this.dialog.open<ExportDialog, ExportRequest>(ExportDialog, {
      data: { facade: this.facade, petName: this.facade.pet()?.name ?? '' },
      width: 'min(520px, 94vw)',
      maxHeight: '92vh',
      panelClass: 'pm-dialog',
      autoFocus: 'first-tabbable',
    });
  }

  remove(one: Memory): void {
    this.facade.remove(one);
  }
}
